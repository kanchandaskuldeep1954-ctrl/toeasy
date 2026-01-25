import React, { useState } from 'react';

// Contact Page for Toeasy AI - Updated with Indian HQ Details
const ContactUs: React.FC = () => {
    const [status, setStatus] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('Message sent successfully!');
    };

    return (
        <div className="py-20 px-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                {/* Left Side: Info */}
                <div className="space-y-12">
                    <div className="space-y-6">
                        <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white leading-tight">
                            How can we <span className="text-indigo-600">help?</span>
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg">
                            Have questions about our enterprise plans, data governance features, or just want to say hi? We're here for you.
                        </p>
                    </div>

                    <div className="space-y-8">
                        {[
                            { title: 'Email Us', info: 'support@toeasy.online', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                            { title: 'Customer Success', info: '+1 (888) TOEASY-AI', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
                            { title: 'Billing Dept', info: 'billing@toeasy.online', icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z' }
                        ].map((item, idx) => (
                            <div key={idx} className="flex gap-6 items-start group">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 dark:text-white mb-1 uppercase tracking-widest text-xs">{item.title}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 font-medium">{item.info}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-8 rounded-3xl bg-slate-900 text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform"></div>
                        <h4 className="text-xl font-black mb-2">Live Support</h4>
                        <p className="text-white/60 text-sm mb-6 max-w-xs">Average response time: 2 minutes. Available 24/7 for Pro and Enterprise users.</p>
                        <button className="px-6 py-2 rounded-xl bg-white text-slate-900 text-sm font-black hover:bg-slate-100 transition-colors">Start Chatting</button>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="glass-card rounded-[40px] p-8 md:p-12 border border-white/20 dark:border-white/5 relative">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    {status ? (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in">
                            <div className="w-20 h-20 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white">Success!</h2>
                            <p className="text-slate-500 max-w-xs">{status}</p>
                            <button onClick={() => setStatus(null)} className="text-indigo-600 font-bold hover:underline">Send another message</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">First Name</label>
                                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="John" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Last Name</label>
                                    <input required type="text" className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="Doe" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Email Address</label>
                                <input required type="email" className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" placeholder="john@company.com" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Inquiry Type</label>
                                <select className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer">
                                    <option>General Inquiry</option>
                                    <option>Sales & Partnerships</option>
                                    <option>Technical Support</option>
                                    <option>Billing Question</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">How can we help?</label>
                                <textarea required rows={4} className="w-full px-5 py-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all resize-none" placeholder="Tell us about your project..."></textarea>
                            </div>

                            <button type="submit" className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                Send Message
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
