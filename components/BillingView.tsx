
import React, { useState } from 'react';
import { Subscription, UserUsage, PlanTier } from '../types';

interface BillingViewProps {
  subscription: Subscription;
  usage: UserUsage;
  onUpgrade: (tier: PlanTier, interval: 'month' | 'year') => void;
}

const BillingView: React.FC<BillingViewProps> = ({ subscription, usage, onUpgrade }) => {
  const [billingCycle, setBillingCycle] = useState<'month' | 'year'>(subscription.interval);

  const plans = [
    {
      id: 'basic' as PlanTier,
      name: 'Starter',
      price: 0,
      description: 'Ideal for small scale personal data projects.',
      features: ['Up to 500 rows', '10 AI Queries / day', '1 Data Connector', 'Basic Audit'],
      buttonText: subscription.tier === 'basic' ? 'Current Plan' : 'Downgrade',
      limitRows: 500,
      limitQueries: 10
    },
    {
      id: 'pro' as PlanTier,
      name: 'Professional',
      price: billingCycle === 'month' ? 29 : 24,
      description: 'Powerful tools for data analysts and consultants.',
      features: ['Up to 50,000 rows', 'Unlimited AI Queries', '5 Data Connectors', 'Custom Validation Rules', 'Executive Reports'],
      buttonText: subscription.tier === 'pro' ? 'Current Plan' : 'Upgrade to Pro',
      highlight: true,
      limitRows: 50000,
      limitQueries: 999999
    },
    {
      id: 'enterprise' as PlanTier,
      name: 'Enterprise',
      price: billingCycle === 'month' ? 99 : 82,
      description: 'The complete data OS for modern businesses.',
      features: ['Unlimited rows', 'Unlimited AI Queries', 'All Connectors (SQL, APIs)', 'Priority AI Processing', 'SSO & Advanced Security', 'API Access'],
      buttonText: subscription.tier === 'enterprise' ? 'Current Plan' : 'Contact Sales',
      limitRows: 999999999,
      limitQueries: 999999
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-700">
      <div className="text-center space-y-6">
        <h2 className="text-5xl font-extrabold text-white tracking-tight">Flexible <span className="text-indigo-500">Plans</span> for Every Data Need</h2>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Choose the plan that fits your analysis scale. Save 20% on yearly billing.
        </p>

        <div className="inline-flex items-center p-1 bg-white/5 border border-white/10 rounded-2xl">
          <button 
            onClick={() => setBillingCycle('month')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'month' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setBillingCycle('year')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'year' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            Yearly (Save 20%)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`relative flex flex-col p-8 glass-morphism rounded-[40px] border transition-all ${
              plan.highlight 
              ? 'border-indigo-500/50 bg-indigo-500/[0.03] scale-105 z-10' 
              : 'border-white/10 hover:border-white/20'
            }`}
          >
            {plan.highlight && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-xl">
                Recommended
              </div>
            )}
            
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-black text-white">${plan.price}</span>
                <span className="text-slate-500 text-sm font-medium">/{billingCycle === 'month' ? 'mo' : 'mo (billed yearly)'}</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{plan.description}</p>
            </div>

            <div className="flex-1 space-y-4 mb-8">
              {plan.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <svg className="w-5 h-5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => plan.id !== subscription.tier && onUpgrade(plan.id, billingCycle)}
              disabled={plan.id === subscription.tier}
              className={`w-full py-4 rounded-2xl font-bold transition-all ${
                plan.id === subscription.tier 
                ? 'bg-white/5 text-slate-500 cursor-default' 
                : plan.highlight 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30' 
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {plan.buttonText}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-morphism rounded-[32px] border border-white/10 p-8 space-y-6">
          <h4 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">📊</div>
            Current Usage
          </h4>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                <span>Rows Processed</span>
                <span>{usage.rowsProcessed.toLocaleString()} / {subscription.tier === 'basic' ? '500' : '50k+'}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (usage.rowsProcessed / (subscription.tier === 'basic' ? 500 : 50000)) * 100)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                <span>AI Queries Used</span>
                <span>{usage.aiQueriesUsed} / {subscription.tier === 'basic' ? '10' : 'Unlimited'}</span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (usage.aiQueriesUsed / (subscription.tier === 'basic' ? 10 : 100)) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-morphism rounded-[32px] border border-white/10 p-8 flex flex-col justify-center space-y-4 bg-emerald-500/[0.02]">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-2xl">⚡</div>
             <div>
                <p className="text-white font-bold">Billing is Genuine & Transparent</p>
                <p className="text-sm text-slate-400">We only charge for the compute power and AI context your analysis actually uses.</p>
             </div>
           </div>
           <div className="pt-4 flex gap-3">
              <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                 <p className="text-[10px] text-slate-500 font-bold uppercase">Next Invoice</p>
                 <p className="text-lg font-mono text-white">${plans.find(p => p.id === subscription.tier)?.price || 0}.00</p>
              </div>
              <div className="flex-1 p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                 <p className="text-[10px] text-slate-500 font-bold uppercase">Period Ends</p>
                 <p className="text-lg font-mono text-white">{subscription.expiresAt.toLocaleDateString()}</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default BillingView;
