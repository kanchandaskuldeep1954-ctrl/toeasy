import React from 'react';

const RefundPolicy: React.FC = () => {
    return (
        <div className="py-20 px-4 max-w-4xl mx-auto space-y-12">
            <div className="space-y-4 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">Cancellations & Refunds</h1>
                <p className="text-slate-500 font-medium italic">Last Updated: January 18, 2026</p>
            </div>

            <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">1. Subscription Cancellation</h2>
                    <p>
                        You can cancel your Toeasy AI subscription at any time through your Billing settings or by contacting our support team. Cancellation will take effect at the end of the current billing period.
                    </p>
                    <p>
                        Upon cancellation, you will continue to have access to Pro features until the end of your prepaid period. No further charges will be made after cancellation.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">2. Refund Eligibility</h2>
                    <p>
                        At Toeasy.AI, we want you to be completely satisfied with our Service. We offer a <strong>14-day money-back guarantee</strong> for new subscriptions if you are not satisfied with the platform.
                    </p>
                    <p>Refunds are generally NOT provided for:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Partial months or years of service.</li>
                        <li>Subscription renewals (unless requested within 48 hours of charge).</li>
                        <li>Accounts terminated due to violations of our Terms of Service.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">3. How to Request a Refund</h2>
                    <p>
                        To request a refund, please email <a href="mailto:billing@toeasy.ai" className="text-indigo-600 font-bold hover:underline">billing@toeasy.ai</a> within 14 days of your initial purchase. Please include your account email and the reason for your request.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">4. Refund Processing</h2>
                    <p>
                        Once approved, refunds will be processed within 5-10 business days. The refund will be credited back to the original payment method used for the purchase.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">5. Plan Transitions</h2>
                    <p>
                        If you upgrade your plan, the new rate will be applied immediately, and the remaining balance from your previous plan will be credited towards the new plan. If you downgrade, the new rate will apply at the start of your next billing cycle.
                    </p>
                </section>

                <div className="pt-12 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-sm text-slate-500">Questions about your bill? We're here to help. Reach out to <a href="mailto:support@toeasy.ai" className="text-indigo-600 font-bold hover:underline">support@toeasy.ai</a>.</p>
                </div>
            </div>
        </div>
    );
};

export default RefundPolicy;
