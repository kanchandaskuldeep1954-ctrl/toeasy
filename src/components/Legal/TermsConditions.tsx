import React from 'react';

const TermsConditions: React.FC = () => {
    return (
        <div className="py-20 px-4 max-w-4xl mx-auto space-y-12">
            <div className="space-y-4 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">Terms & Conditions</h1>
                <p className="text-slate-500 font-medium italic">Last Updated: January 18, 2026</p>
            </div>

            <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using the Toeasy.AI platform ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use our Service. These Terms apply to all visitors, users, and others who access or use the Service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">2. Use of Service</h2>
                    <p>Toeasy.AI provides an AI-powered data governance and cleaning platform. You are responsible for:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Maintaining the confidentiality of your account credentials.</li>
                        <li>Ensuring all data uploaded complies with applicable laws and regulations.</li>
                        <li>All activities that occur under your account.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">3. User Data & Privacy</h2>
                    <p>
                        Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal data. By using our Service, you agree to the collection and use of information in accordance with our Privacy Policy.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">4. Intellectual Property</h2>
                    <p>
                        The Service and its original content (excluding User Data), features, and functionality are and will remain the exclusive property of Toeasy AI and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Toeasy AI.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">5. Subscription & Billing</h2>
                    <p>
                        Certain parts of the Service are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis (monthly or annually). A valid payment method is required to process the payment for your subscription.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">6. Limitation of Liability</h2>
                    <p>
                        In no event shall Toeasy AI, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">7. Changes to Terms</h2>
                    <p>
                        We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days' notice prior to any new terms taking effect.
                    </p>
                </section>

                <div className="pt-12 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-sm text-slate-500">If you have any questions about these Terms, please <a href="/contact" className="text-indigo-600 font-bold hover:underline">contact us</a>.</p>
                </div>
            </div>
        </div>
    );
};

export default TermsConditions;
