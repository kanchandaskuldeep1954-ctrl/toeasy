/**
 * Payment Flow Component
 * Handles Cashfree payment integration with success/failure handling
 * Works seamlessly with BillingViewIntegrated
 * 
 * Features:
 * - Cashfree payment modal
 * - Order creation and verification
 * - Subscription update on success
 * - Error recovery with retry option
 * - Payment status polling
 * - Confirmation modal with success/failure states
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { paymentAPI } from '../services/api';

interface PaymentFlowProps {
  isOpen: boolean;
  onClose: () => void;
  planId: 'pro' | 'enterprise';
  amount: number;
  interval: 'month' | 'year';
  onPaymentSuccess: () => void;
}

interface PaymentState {
  status: 'idle' | 'creating_order' | 'awaiting_payment' | 'verifying' | 'success' | 'failed';
  orderId?: string;
  error?: string;
  retryCount: number;
}

declare global {
  interface Window {
    Cashfree?: any;
  }
}

export const PaymentFlow: React.FC<PaymentFlowProps> = ({
  isOpen,
  onClose,
  planId,
  amount,
  interval,
  onPaymentSuccess,
}) => {
  const [paymentState, setPaymentState] = useState<PaymentState>({
    status: 'idle',
    retryCount: 0,
  });

  // Create payment order
  const handleCreateOrder = async () => {
    try {
      setPaymentState(prev => ({ ...prev, status: 'creating_order' }));

      const response = await paymentAPI.createOrder(planId, amount, interval);
      const { orderId, paymentSessionId, redirectUrl } = response.data;

      if (redirectUrl && window.Cashfree) {
        // Initialize Cashfree SDK
        const cashfree = new window.Cashfree();

        setPaymentState(prev => ({
          ...prev,
          status: 'awaiting_payment',
          orderId,
        }));

        // Open payment modal
        cashfree.redirect(redirectUrl);

        // Poll for payment status every 2 seconds
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await paymentAPI.getStatus(orderId);
            const { status } = statusResponse.data;

            if (status === 'completed') {
              clearInterval(pollInterval);
              setPaymentState(prev => ({ ...prev, status: 'success' }));
              setTimeout(() => {
                onPaymentSuccess();
                handleClose();
              }, 2000);
            } else if (status === 'failed') {
              clearInterval(pollInterval);
              setPaymentState(prev => ({
                ...prev,
                status: 'failed',
                error: 'Payment failed. Please try again.',
              }));
            }
          } catch (err) {
            // Continue polling if status check fails
          }
        }, 2000);

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
      } else {
        throw new Error('Payment gateway not available');
      }
    } catch (err: any) {
      setPaymentState(prev => ({
        ...prev,
        status: 'failed',
        error: err.response?.data?.error || 'Failed to create payment order',
        retryCount: prev.retryCount + 1,
      }));
    }
  };

  const handleRetry = () => {
    if (paymentState.retryCount < 3) {
      handleCreateOrder();
    }
  };

  const handleClose = () => {
    setPaymentState({ status: 'idle', retryCount: 0 });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {paymentState.status === 'success' ? '✓ Payment Successful' : 'Complete Payment'}
          </h2>
          {!['success', 'failed'].includes(paymentState.status) && (
            <button
              onClick={handleClose}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        {paymentState.status === 'idle' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">Plan</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                {planId === 'pro' ? 'Pro Plan' : 'Enterprise Plan'} ({interval === 'month' ? 'Monthly' : 'Yearly'})
              </p>
            </div>

            <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/20">
              <p className="text-sm text-indigo-600 dark:text-indigo-400">Amount</p>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                ${amount.toFixed(2)}
              </p>
            </div>

            <div className="border-t border-slate-200 pt-4 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You will be redirected to Cashfree to complete the payment securely.
              </p>
            </div>

            <button
              onClick={handleCreateOrder}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              Proceed to Payment
            </button>

            <button
              onClick={handleClose}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        )}

        {paymentState.status === 'creating_order' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-500"></div>
            <p className="text-slate-600 dark:text-slate-400">Creating payment order...</p>
          </div>
        )}

        {paymentState.status === 'awaiting_payment' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600 dark:border-slate-700 dark:border-t-indigo-500"></div>
            <p className="text-center text-slate-600 dark:text-slate-400">
              Waiting for payment confirmation...
              <br />
              <span className="text-sm">A payment page should have opened</span>
            </p>
          </div>
        )}

        {paymentState.status === 'verifying' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600 dark:border-slate-700 dark:border-t-emerald-500"></div>
            <p className="text-slate-600 dark:text-slate-400">Verifying payment...</p>
          </div>
        )}

        {paymentState.status === 'success' && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/20">
                <svg
                  className="h-12 w-12 text-emerald-600 dark:text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Payment Successful!
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Your subscription to <strong>{planId === 'pro' ? 'Pro' : 'Enterprise'}</strong> plan is now active.
              </p>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Order ID</span>
                <span className="font-mono text-slate-900 dark:text-white">
                  {paymentState.orderId?.substring(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Amount Paid</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-500">${amount.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              Continue to Dashboard
            </button>
          </div>
        )}

        {paymentState.status === 'failed' && (
          <div className="space-y-4">
            <div className="rounded-lg bg-rose-50 p-4 dark:bg-rose-900/20">
              <div className="flex items-start gap-3">
                <svg
                  className="h-6 w-6 text-rose-600 dark:text-rose-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-semibold text-rose-900 dark:text-rose-100">
                    Payment Failed
                  </h3>
                  <p className="mt-1 text-sm text-rose-800 dark:text-rose-200">
                    {paymentState.error || 'Something went wrong during payment processing.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Retry Attempts: {paymentState.retryCount} / 3
              </div>
              {paymentState.retryCount < 3 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  You can retry your payment. No charge has been made yet.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {paymentState.retryCount < 3 ? (
                <>
                  <button
                    onClick={handleRetry}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleClose}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Maximum retry attempts reached.
                  </p>
                  <button
                    onClick={handleClose}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentFlow;
