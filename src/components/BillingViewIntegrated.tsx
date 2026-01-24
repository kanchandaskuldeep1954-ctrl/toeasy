import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import PaymentFlow from './PaymentFlow';

interface SubscriptionData {
  id: string;
  user_id: string;
  tier: 'basic' | 'pro' | 'enterprise';
  interval: 'month' | 'year';
  status: 'active' | 'canceled' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

interface UsageData {
  datasets_used: number;
  datasets_limit: number;
  api_calls_used: number;
  api_calls_limit: number;
  storage_used_gb: number;
  storage_limit_gb: number;
  rows_processed: number;
  queries_executed: number;
}

interface PaymentFlowState {
  isOpen: boolean;
  planId?: 'pro' | 'enterprise';
  amount?: number;
  interval?: 'month' | 'year';
  currency?: 'USD' | 'INR';
}

const BillingViewIntegrated: React.FC = () => {
  const { token, refreshProfile } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData>({
    datasets_used: 0,
    datasets_limit: 10,
    api_calls_used: 0,
    api_calls_limit: 100,
    storage_used_gb: 0,
    storage_limit_gb: 1,
    rows_processed: 0,
    queries_executed: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>('month');
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [processingTier, setProcessingTier] = useState<string | null>(null);
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlowState>({
    isOpen: false,
  });

  const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

  useEffect(() => {
    if (token) {
      loadSubscriptionAndUsage();
    }
  }, [token]);

  const loadSubscriptionAndUsage = async () => {
    try {
      setLoading(true);
      const [subRes, usageRes] = await Promise.all([
        axios.get(`${backendUrl}/subscriptions/current`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${backendUrl}/users/me/usage`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setSubscription(subRes.data);
      setBillingCycle(subRes.data.interval);

      // Handle both old and new usage response formats
      const usageData = usageRes.data;
      if (usageData.stats) {
        // New format: { tier, stats: {...} }
        setUsage({
          datasets_used: usageData.stats.datasets || 0,
          datasets_limit: 100,
          api_calls_used: usageData.stats.api_calls_used || 0,
          api_calls_limit: 999999,
          storage_used_gb: usageData.stats.storage_used_gb || 0,
          storage_limit_gb: 100,
          rows_processed: usageData.stats.rows_processed || 0,
          queries_executed: usageData.stats.queries_executed || 0
        });
      } else {
        // Old format or direct stats
        setUsage({
          datasets_used: usageData.datasets_used || 0,
          datasets_limit: usageData.datasets_limit || 100,
          api_calls_used: usageData.api_calls_used || 0,
          api_calls_limit: usageData.api_calls_limit || 999999,
          storage_used_gb: usageData.storage_used_gb || 0,
          storage_limit_gb: usageData.storage_limit_gb || 100,
          rows_processed: usageData.rows_processed || 0,
          queries_executed: usageData.queries_executed || 0
        });
      }
      setError(null);
    } catch (err) {
      setError('Failed to load subscription data');
      console.error(err);
      // Set default usage on error
      setUsage({
        datasets_used: 0,
        datasets_limit: 10,
        api_calls_used: 0,
        api_calls_limit: 100,
        storage_used_gb: 0,
        storage_limit_gb: 1,
        rows_processed: 0,
        queries_executed: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string, price: number) => {
    // Downgrade to free
    if (price === 0) {
      if (!window.confirm('Are you sure? Premium features will be locked.')) return;
      try {
        await axios.post(
          `${backendUrl}/subscriptions/downgrade-to-free`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        loadSubscriptionAndUsage();
      } catch (err) {
        setError('Failed to downgrade');
      }
      return;
    }

    // Open payment flow for paid plans
    const amount = billingCycle === 'year' ? price * 12 : price;
    setPaymentFlow({
      isOpen: true,
      planId: planId as 'pro' | 'enterprise',
      amount,
      interval: billingCycle,
      currency
    });
  };

  const handlePaymentSuccess = () => {
    // Refresh subscription data after successful payment
    loadSubscriptionAndUsage();
    // Also refresh the global user profile to update sidebar tier/name
    if (refreshProfile) refreshProfile();
    setPaymentFlow({ isOpen: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-400">Loading billing information...</div>
      </div>
    );
  }

  const plans = [
    {
      id: 'basic',
      name: 'Starter',
      monthlyPrice: 0,
      yearlyPrice: 0,
      description: 'Perfect for getting started',
      features: ['Up to 10 datasets', '100 API calls/day', '1GB storage', 'Basic support'],
      isCurrent: subscription?.tier === 'basic',
      isPopular: false
    },
    {
      id: 'pro',
      name: 'Professional',
      monthlyPrice: currency === 'INR' ? 599 : 25,
      yearlyPrice: currency === 'INR' ? 499 : 20, // yearly billed monthly equivalent usually display
      // Actual yearly charge: 499 * 12 = 5990 INR, 20 * 12 = 240 USD
      description: 'For active data teams',
      features: ['Up to 100 datasets', 'Unlimited API calls', '100GB storage', 'Priority support', 'Advanced validation'],
      isCurrent: subscription?.tier === 'pro',
      isPopular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: currency === 'INR' ? 2599 : 89,
      yearlyPrice: currency === 'INR' ? 2165 : 74, // 2165 * 12 ~= 25990 INR, 74 * 12 ~= 890 USD
      description: 'For large organizations',
      features: ['Unlimited datasets', 'Unlimited API calls', 'Unlimited storage', '24/7 support', 'SSO & Security', 'Custom integrations'],
      isCurrent: subscription?.tier === 'enterprise',
      isPopular: false
    }
  ];

  return (
    <div className="max-w-7xl mx-auto py-12 px-4">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">
          Subscription & Billing
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">Manage your plan and view usage</p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl">
          {error}
        </div>
      )}

      {/* Current Plan Summary */}
      {subscription && (
        <div className="mb-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Current Plan</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white capitalize">{subscription.tier}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Billing Cycle</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white capitalize">{subscription.interval}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-lg font-bold text-slate-900 dark:text-white capitalize">{subscription.status}</span>
              </div>
              <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Renews</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Overview */}
      {usage && (
        <div className="mb-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
            <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-3">Datasets</p>
            <p className="text-3xl font-black text-indigo-600 mb-2">{usage.datasets_used}</p>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${Math.min(100, (usage.datasets_used / usage.datasets_limit) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-2">
              of {usage.datasets_limit} limit
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
            <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-3">API Calls</p>
            <p className="text-3xl font-black text-cyan-600 mb-2">{(usage.api_calls_used || 0).toLocaleString()}</p>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 transition-all"
                style={{ width: `${Math.min(100, ((usage.api_calls_used || 0) / (usage.api_calls_limit || 100)) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-2">
              of {(usage.api_calls_limit || 100) === 999999 ? '∞' : (usage.api_calls_limit || 100).toLocaleString()} limit
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
            <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-3">Storage</p>
            <p className="text-3xl font-black text-emerald-600 mb-2">{((usage.storage_used_gb || 0).toFixed ? (usage.storage_used_gb || 0).toFixed(1) : '0.0')} GB</p>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${Math.min(100, ((usage.storage_used_gb || 0) / (usage.storage_limit_gb || 100)) * 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-2">
              of {usage.storage_limit_gb || 100} GB limit
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-6">
            <p className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-3">This Month</p>
            <p className="text-3xl font-black text-amber-600 mb-2">{(usage.queries_executed || 0).toLocaleString()}</p>
            <p className="text-[9px] text-slate-600 dark:text-slate-400">queries executed</p>
          </div>
        </div>
      )}

      {/* Controls: Billing Cycle & Currency */}
      <div className="mb-12 flex flex-col md:flex-row justify-center items-center gap-6">
        {/* Cycle */}
        <div className="inline-flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setBillingCycle('month')}
            className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${billingCycle === 'month'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('year')}
            className={`px-6 py-2 rounded-lg font-bold text-[10px] uppercase transition-all relative ${billingCycle === 'year'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            Yearly
            <span className="absolute -top-3 -right-2 bg-emerald-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>

        {/* Currency Toggle */}
        <div className="inline-flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setCurrency('USD')}
            className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${currency === 'USD'
              ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            🇺🇸 USD
          </button>
          <button
            onClick={() => setCurrency('INR')}
            className={`px-4 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${currency === 'INR'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
          >
            🇮🇳 INR
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {plans.map(plan => {
          const price = billingCycle === 'month' ? plan.monthlyPrice : plan.yearlyPrice;
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border transition-all ${plan.isPopular
                ? 'border-indigo-500/50 shadow-2xl shadow-indigo-500/10 scale-105 lg:scale-110 z-10'
                : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 overflow-hidden`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-0 right-0 bg-indigo-600 text-white text-center py-1 text-[9px] font-black uppercase">
                  Recommended
                </div>
              )}

              <div className={`p-8 ${plan.isPopular ? 'pt-12' : ''}`}>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{plan.description}</p>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900 dark:text-white">
                      {currency === 'INR' ? '₹' : '$'}{price}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">/{billingCycle === 'month' ? 'mo' : 'mo'}</span>
                  </div>
                  {billingCycle === 'year' && price > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2">
                      {currency === 'INR' ? '₹' : '$'}{Math.round(price * 12)} billed yearly
                    </p>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <svg className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id, price)}
                  disabled={plan.isCurrent || processingTier !== null}
                  className={`w-full py-3 rounded-xl font-bold text-[10px] uppercase transition-all ${plan.isCurrent
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-default'
                    : plan.isPopular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {processingTier === plan.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : plan.isCurrent ? (
                    'Current Plan'
                  ) : price === 0 ? (
                    'Downgrade'
                  ) : (
                    'Upgrade'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg p-8">
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-6">
          Billing Information
        </h3>
        {subscription && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Current Amount</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">
                ${(subscription.amount || 0).toFixed(2)}
              </p>
              <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">per {subscription.interval}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Period Start</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {new Date(subscription.current_period_start).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-2">Period End</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Flow Modal */}
      <PaymentFlow
        isOpen={paymentFlow.isOpen}
        onClose={() => setPaymentFlow({ ...paymentFlow, isOpen: false })}
        planId={paymentFlow.planId || 'pro'}
        amount={paymentFlow.amount || 0}
        interval={paymentFlow.interval || 'month'}
        currency={paymentFlow.currency || 'USD'}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
};

export default BillingViewIntegrated;
