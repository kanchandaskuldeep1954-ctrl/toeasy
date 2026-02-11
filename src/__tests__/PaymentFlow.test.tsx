/**
 * PaymentFlow Component Tests
 * Tests payment modal states, order creation, and status polling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import PaymentFlow from '../components/PaymentFlow';

// Mock Axios with a factory
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  isAxiosError: jest.fn((payload) => payload?.isAxiosError === true),
}));

const mockedAxios = mockAxiosInstance as unknown as jest.Mocked<typeof axios>;

// Mock Razorpay
const mockRazorpayOpen = jest.fn();
const mockRazorpayOn = jest.fn();
window.Razorpay = jest.fn().mockImplementation((options) => {
  // Automatically call handler for success path if intended, 
  // or store options to manually trigger in tests.
  // For now, we'll expose a helper or just rely on the test firing it?
  // The test logic seems to assume automatic flow or manual trigger?
  // The existing test "should show success" waits for timers.
  // This implies the handler is NOT called automatically by the mock unless we make it so.
  // We'll store the options globally or on the window to access them?
  // Actually, let's just make it simple:
  if (options.handler) {
    // Simulate immediate success for now
    // But wait, some tests test failure.
    // We should attach the instance to window for test access?
    (window as any).razorpayOptions = options;
  }
  return {
    open: mockRazorpayOpen,
    on: mockRazorpayOn,
  };
});

describe('PaymentFlow Component', () => {
  const mockOnClose = jest.fn();
  const mockOnPaymentSuccess = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    planId: 'pro' as const,
    amount: 29,
    interval: 'month' as const,
    currency: 'USD' as const,
    onPaymentSuccess: mockOnPaymentSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(
        <PaymentFlow {...defaultProps} isOpen={false} />
      );
      expect(screen.queryByText('Complete Payment')).not.toBeInTheDocument();
    });

    it('should render modal when isOpen is true', () => {
      render(<PaymentFlow {...defaultProps} />);
      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
    });

    it('should display plan details', () => {
      render(<PaymentFlow {...defaultProps} />);
      expect(screen.getByText('Pro Plan (Monthly)')).toBeInTheDocument();
      expect(screen.getByText('₹29.00')).toBeInTheDocument();
    });

    it('should display correct plan for enterprise', () => {
      render(
        <PaymentFlow {...defaultProps} planId="enterprise" amount={99} />
      );
      expect(screen.getByText('Enterprise Plan (Monthly)')).toBeInTheDocument();
    });
  });

  describe('Order Creation', () => {
    it('should create order on button click', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Pay with Razorpay'));

      await waitFor(() => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          '/api/payments/create-order',
          {
            planId: 'pro',
            amount: 29,
            interval: 'month',
          }
        );
      });
    });

    it('should show loading state during order creation', async () => {
      mockedAxios.post.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          data: { orderId: 'ORDER_123', paymentSessionId: 'session_abc', redirectUrl: 'https://cashfree.com/pay' },
        }), 100))
      );

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Pay with Razorpay'));

      expect(screen.getByText('Initializing payment...')).toBeInTheDocument();
    });

    it('should handle order creation error', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: 'Invalid plan' } },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Pay with Razorpay'));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid plan')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Success Logic', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });



    it('should show success when payment completes', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          key: 'rzp_test_123',
          amount: 2900,
          currency: 'INR',
          name: 'Pro Plan',
          description: 'Monthly Subscription',
          order_id: 'ORDER_123',
          subscription_id: 'sub_123',
          prefill: { email: 'test@example.com' }
        },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Pay with Razorpay'));

      // Simulate Razorpay success
      await waitFor(() => {
        expect(window.Razorpay).toHaveBeenCalled();
      });

      const razorpayOptions = (window as any).razorpayOptions;

      // Trigger success handler
      React.act(() => {
        razorpayOptions.handler({
          razorpay_payment_id: 'pay_123',
          razorpay_order_id: 'ORDER_123',
          razorpay_signature: 'sig_123'
        });
      });

      // Check success state
      await waitFor(() => {
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      });

      // Advance timer for close
      React.act(() => {
        jest.advanceTimersByTime(2100);
      });

      await waitFor(() => {
        expect(mockOnPaymentSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });


  });

  describe('Retry Logic', () => {
    it('should allow retry on payment failure', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: 'Payment failed' } },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Pay with Razorpay'));

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      fireEvent.click(screen.getByText('Try Again'));

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should limit retries to 3 attempts', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: 'Payment failed' } },
      });

      render(<PaymentFlow {...defaultProps} />);

      // First attempt
      fireEvent.click(screen.getByText('Pay with Razorpay'));
      await waitFor(() => {
        expect(screen.getByText('Retry Attempts: 1 / 3')).toBeInTheDocument();
      });

      // Second attempt
      fireEvent.click(screen.getByText('Try Again'));
      await waitFor(() => {
        expect(screen.getByText('Retry Attempts: 2 / 3')).toBeInTheDocument();
      });

      // Third attempt
      fireEvent.click(screen.getByText('Try Again'));
      await waitFor(() => {
        expect(screen.getByText('Retry Attempts: 3 / 3')).toBeInTheDocument();
      });

      // Should show max retry message
      await waitFor(() => {
        expect(screen.getByText('Maximum retry attempts reached.')).toBeInTheDocument();
      });
    });
  });

  describe('Modal Actions', () => {
    it('should close modal on close button click', () => {
      render(<PaymentFlow {...defaultProps} />);
      const closeButton = screen.getByText('✕');
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });




  });
});
