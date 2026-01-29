import React, { useState } from 'react';
import { ChevronDown, Search, MessageSquare, Phone, Mail } from 'lucide-react';

import { BILLING_PLANS } from '../config/plans';

const basicPlan = BILLING_PLANS.find(p => p.id === 'basic');
const proPlan = BILLING_PLANS.find(p => p.id === 'pro');

const faqData = [
    {
        category: 'Getting Started',
        questions: [
            {
                q: 'What is Toeasy AI?',
                a: 'Toeasy AI is a next-generation data operating system that uses artificial intelligence to help you clean, analyze, and visualize your data without writing complex code. Connect your database or upload a CSV, and let AI do the heavy lifting.'
            },
            {
                q: 'How do I create my first workspace?',
                a: 'From the "Workspaces" dashboard, click "New Workspace". Note that on the Starter plan, you are limited to 1 active workspace.'
            }
        ]
    },
    {
        category: 'Billing & Plans',
        questions: [
            {
                q: 'What are the limits of the Starter plan?',
                a: `The Starter plan includes 1 Workspace, 3 Datasets, and a limit of ${basicPlan?.limitRows.toLocaleString()} rows per dataset. You also get ${basicPlan?.limitQueries} AI-powered queries per day to help you explore your data.`
            },
            {
                q: 'How do I upgrade to the Pro plan?',
                a: `Navigate to the "Billing" section in your sidebar. Select the "Professional" plan and choose between monthly or yearly billing to unlock powerful features and ${proPlan?.limitQueries === 999999 ? 'unlimited' : proPlan?.limitQueries} AI queries.`
            },
            {
                q: 'Can I cancel my subscription anytime?',
                a: 'Yes, you can cancel your subscription from the Billing settings. You will retain access to your plan features until the end of your current billing period.'
            }
        ]
    },
    {
        category: 'Security & Privacy',
        questions: [
            {
                q: 'Is my data secure with Toeasy?',
                a: 'Absolutely. We use industry-standard AES-256 encryption for all stored credentials and SSL/TLS for data in transit. We never sell your data; it is used only to provide you with AI-driven insights.'
            },
            {
                q: 'Where do I find your privacy policy?',
                a: 'Our privacy policy is available at the bottom of every page or by contacting support@toeasy.online.'
            }
        ]
    }
];

export const FAQ: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [openItems, setOpenItems] = useState<string[]>([]);

    const toggleItem = (q: string) => {
        setOpenItems(prev => prev.includes(q) ? prev.filter(i => i !== q) : [...prev, q]);
    };

    const filteredFaq = faqData.map(category => ({
        ...category,
        questions: category.questions.filter(item =>
            item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.a.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.questions.length > 0);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 transition-colors">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-4">FAQ & Help Center</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg mb-8">Everything you need to know about the Toeasy Data OS</p>

                    <div className="relative max-w-xl mx-auto">
                        <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search for answers..."
                            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-900 dark:text-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-12">
                    {filteredFaq.map((category, idx) => (
                        <div key={idx}>
                            <h2 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest mb-6 px-2">{category.category}</h2>
                            <div className="space-y-4">
                                {category.questions.map((item, qIdx) => (
                                    <div key={qIdx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm transition-all">
                                        <button
                                            onClick={() => toggleItem(item.q)}
                                            className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{item.q}</span>
                                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openItems.includes(item.q) ? 'rotate-180' : ''}`} />
                                        </button>
                                        {openItems.includes(item.q) && (
                                            <div className="px-6 pb-6 text-slate-600 dark:text-slate-400 leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                                                {item.a}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Contact Footer */}
                <div className="mt-20 p-8 bg-indigo-600 rounded-[32px] text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl shadow-indigo-600/30">
                    <div>
                        <h3 className="text-2xl font-black tracking-tight mb-2">Still have questions?</h3>
                        <p className="text-indigo-100 font-medium">Our customer success team is here to help you scaling your data.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <a href="mailto:support@toeasy.online" className="flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold hover:scale-105 transition-all">
                            <Mail className="w-4 h-4" /> Support Email
                        </a>
                        <a href="tel:+1888TOEASYAI" className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white border border-indigo-400 rounded-xl font-bold hover:scale-105 transition-all">
                            <Phone className="w-4 h-4" /> Call Success
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FAQ;
