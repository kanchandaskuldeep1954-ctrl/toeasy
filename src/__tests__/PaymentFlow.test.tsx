/**
 * PaymentFlow Component Tests
 * Tests payment modal states, order creation, and status polling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axios from 'axios';
import PaymentFlow from '../components/PaymentFlow';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentFlow Component', () => {
  const mockOnClose = jest.fn();
  const mockOnPaymentSuccess = jest.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    planId: 'pro' as const,
    amount: 29,
    interval: 'month' as const,
    onPaymentSuccess: mockOnPaymentSuccess,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
      fireEvent.click(screen.getByText('Proceed to Payment'));

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
      fireEvent.click(screen.getByText('Proceed to Payment'));

      expect(screen.getByText('Creating payment order...')).toBeInTheDocument();
    });

    it('should handle order creation error', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: 'Invalid plan' } },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid plan')).toBeInTheDocument();
      });
    });
  });

  describe('Payment Status Polling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should poll payment status after order creation', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      mockedAxios.get.mockResolvedValue({
        data: { status: 'pending' },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

      await waitFor(() => {
        jest.advanceTimersByTime(2100);
        expect(mockedAxios.get).toHaveBeenCalledWith('/api/payments/status/ORDER_123');
      });
    });

    it('should show success when payment completes', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      mockedAxios.get.mockResolvedValue({
        data: { status: 'completed' },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

      await waitFor(() => {
        jest.advanceTimersByTime(2100);
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(mockOnPaymentSuccess).toHaveBeenCalled();
      });
    });

    it('should stop polling after 5 minutes', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      mockedAxios.get.mockResolvedValue({
        data: { status: 'pending' },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      expect(mockedAxios.get).toHaveBeenCalledTimes(
        Math.floor((5 * 60 * 1000) / 2000) + 1
      );
    });
  });

  describe('Retry Logic', () => {
    it('should allow retry on payment failure', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { data: { error: 'Payment failed' } },
      });

      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

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
      fireEvent.click(screen.getByText('Proceed to Payment'));
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

    it('should close modal on cancel button click', () => {
      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should close modal after successful payment', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          orderId: 'ORDER_123',
          paymentSessionId: 'session_abc',
          redirectUrl: 'https://cashfree.com/pay',
        },
      });

      mockedAxios.get.mockResolvedValue({
        data: { status: 'completed' },
      });

      jest.useFakeTimers();
      render(<PaymentFlow {...defaultProps} />);
      fireEvent.click(screen.getByText('Proceed to Payment'));

      jest.advanceTimersByTime(4100);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });
  });
});
