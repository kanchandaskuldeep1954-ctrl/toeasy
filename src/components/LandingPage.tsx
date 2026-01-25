import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Reveal } from './Motion/Reveal';

const LandingPage: React.FC = () => {
    return (
        <div className="relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            {/* Animated Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10 opacity-30 dark:opacity-20 pointer-events-none">
                <motion.div
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3],
                    }}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500 rounded-full blur-[120px]"
                ></motion.div>
                <motion.div
                    animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.2, 0.4, 0.2],
                    }}
                    transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2
                    }}
                    className="absolute top-1/2 right-1/4 w-[400px] h-[400px] bg-purple-500 rounded-full blur-[120px]"
                ></motion.div>
            </div>

            {/* Hero Section */}
            <section className="relative pt-20 pb-32 md:pt-32 md:pb-48 px-4">
                <div className="max-w-7xl mx-auto text-center space-y-10 relative">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        Next Gen Data Governance
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white max-w-5xl mx-auto"
                    >
                        Clean Data. <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-600 bg-300% animate-gradient">Pure Insights.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="text-lg md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed font-medium"
                    >
                        Toeasy AI transforms messy datasets into actionable intelligence. Automated cleaning, smart visualization, and robust governance in one unified platform.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-5 pt-6"
                    >
                        <Link
                            to="/signup"
                            className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black shadow-2xl shadow-indigo-600/40 transition-all hover:scale-110 active:scale-95 group flex items-center gap-2"
                        >
                            Start for free
                            <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold transition-all hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm hover:shadow-xl hover:scale-105 active:scale-95"
                        >
                            View Demo
                        </Link>
                    </motion.div>

                    {/* Dashboard Preview Mockup */}
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.8, ease: "circOut" }}
                        className="mt-20 md:mt-32 relative max-w-6xl mx-auto"
                    >
                        <div className="rounded-[40px] border border-white/20 dark:border-white/5 shadow-[0_50px_100px_-20px_rgba(79,70,229,0.3)] overflow-hidden glass-card p-2 md:p-5 rotate-x-6 transform-gpu hover:rotate-0 transition-transform duration-1000 ease-out cursor-default group">
                            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900 aspect-video relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-purple-500/20 pointer-events-none group-hover:opacity-50 transition-opacity"></div>
                                <div className="p-12 flex flex-col items-center justify-center h-full text-center">
                                    <div className="space-y-8 max-w-2xl">
                                        <motion.div
                                            animate={{ y: [0, -10, 0] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                            className="inline-flex px-5 py-2 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-black uppercase tracking-[0.3em] backdrop-blur-sm"
                                        >
                                            Dynamic Engine v2.4
                                        </motion.div>
                                        <h3 className="text-4xl md:text-6xl font-black text-white leading-tight">
                                            Visualizing Complexity at <span className="text-indigo-500 italic">Speed.</span>
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Infinite Marquee Trust Bar */}
                <div className="mt-32 border-y border-slate-200/50 dark:border-slate-800/50 py-12 bg-slate-50/50 dark:bg-slate-900/50 relative overflow-hidden backdrop-blur-sm">
                    <div className="max-w-7xl mx-auto px-4 mb-10">
                        <p className="text-center text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Trusted Architecture & Integration</p>
                    </div>

                    <div className="flex overflow-hidden group">
                        <motion.div
                            animate={{
                                x: [0, -1000],
                            }}
                            transition={{
                                x: {
                                    repeat: Infinity,
                                    repeatType: "loop",
                                    duration: 30,
                                    ease: "linear",
                                },
                            }}
                            className="flex flex-nowrap shrink-0 gap-20 items-center px-10"
                        >
                            {[...Array(2)].map((_, i) => (
                                <React.Fragment key={i}>
                                    {[
                                        { name: 'PostgreSQL', url: 'https://www.vectorlogo.zone/logos/postgresql/postgresql-icon.svg' },
                                        { name: 'Snowflake', url: 'https://www.vectorlogo.zone/logos/snowflake/snowflake-icon.svg' },
                                        { name: 'BigQuery', url: 'https://www.vectorlogo.zone/logos/google_bigquery/google_bigquery-icon.svg' },
                                        { name: 'MySQL', url: 'https://www.vectorlogo.zone/logos/mysql/mysql-icon.svg' },
                                        { name: 'MongoDB', url: 'https://www.vectorlogo.zone/logos/mongodb/mongodb-icon.svg' },
                                        { name: 'Redis', url: 'https://www.vectorlogo.zone/logos/redis/redis-icon.svg' },
                                        { name: 'AWS', url: 'https://www.vectorlogo.zone/logos/amazon_aws/amazon_aws-icon.svg' },
                                        { name: 'Stripe', url: 'https://www.vectorlogo.zone/logos/stripe/stripe-icon.svg' },
                                        { name: 'Salesforce', url: 'https://www.vectorlogo.zone/logos/salesforce/salesforce-icon.svg' },
                                        { name: 'Tableau', url: 'https://cdn.worldvectorlogo.com/logos/tableau-software.svg' },
                                        { name: 'PowerBI', url: 'https://www.vectorlogo.zone/logos/microsoft_powerbi/microsoft_powerbi-icon.svg' },
                                    ].map((brand) => (
                                        <div key={brand.name + i} className="flex items-center gap-4 group/item cursor-default opacity-40 hover:opacity-100 transition-opacity duration-300">
                                            <div className="w-10 h-10 flex items-center justify-center p-1 transition-all group-hover/item:scale-125">
                                                <img
                                                    src={brand.url}
                                                    alt={brand.name}
                                                    className="w-full h-full object-contain filter grayscale group-hover/item:filter-none transition-all duration-300"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${brand.name}&background=6366f1&color=fff&bold=true&rounded=true`;
                                                    }}
                                                />
                                            </div>
                                            <span className="font-black text-base text-slate-600 dark:text-slate-400 group-hover/item:text-slate-900 dark:group-hover/item:text-white tracking-tight">
                                                {brand.name}
                                            </span>
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 px-4 bg-white dark:bg-slate-900 relative">
                <div className="max-w-7xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center mb-24 space-y-4">
                            <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em]">The Toolkit</h3>
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leadning-none">Built for modern data teams</h2>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {[
                            {
                                title: 'AI Cleaning',
                                desc: 'Automatically detect and fix anomalies, missing values, and inconsistent formatting with our advanced LLM engine.',
                                icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
                                color: 'indigo'
                            },
                            {
                                title: 'Smart Visuals',
                                desc: 'Generate beautiful, interactive D3.js and Plotly charts that respond to your data insights automatically.',
                                icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 v14a2 2 0 002 2h2a2 2 0 002-2z',
                                color: 'purple'
                            },
                            {
                                title: 'Enterprise Logic',
                                desc: 'Build automated pipelines to process data from multiple sources with bank-grade security protocols.',
                                icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
                                color: 'blue'
                            }
                        ].map((feature, idx) => (
                            <Reveal key={idx} delay={0.2 * (idx + 1)}>
                                <div className="p-10 rounded-[40px] border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/80 group h-full shadow-sm hover:shadow-2xl">
                                    <div className={`w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} /></svg>
                                    </div>
                                    <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">{feature.title}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-base leading-relaxed font-semibold">{feature.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it Works Section */}
            <section id="how-it-works" className="py-32 px-4 bg-slate-50 dark:bg-slate-950 transition-colors">
                <div className="max-w-7xl mx-auto text-center">
                    <Reveal width="100%">
                        <div className="space-y-4 mb-24">
                            <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em]">The Process</h3>
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">The Toeasy Engine</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg max-w-xl mx-auto">How we turn raw numbers into business strategy in three simple steps.</p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-20 relative">
                        {/* Connecting Line */}
                        <div className="hidden md:block absolute top-[60px] left-[15%] right-[15%] h-[2px] bg-slate-200 dark:bg-slate-800 -z-10"></div>

                        {[
                            { step: '01', title: 'Connect Data', desc: 'Securely upload CSVs or connect your cloud databases like Postgres, Snowflake, or BigQuery.' },
                            { step: '02', title: 'AI Orchestration', desc: 'Our AI engine scans for errors, enriches fields, and builds a relational map of your datasets automatically.' },
                            { step: '03', title: 'Instant Insights', desc: 'Ask natural language questions like "What is our churn?" and get instant SQL-backed charts and reports.' }
                        ].map((item, idx) => (
                            <Reveal key={idx} delay={0.3 * (idx + 1)}>
                                <div className="relative group">
                                    <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-900 border-4 border-slate-100 dark:border-slate-800 flex items-center justify-center mx-auto mb-8 shadow-xl group-hover:scale-110 group-hover:border-indigo-600 transition-all duration-500">
                                        <span className="text-xl font-black text-indigo-600">{item.step}</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-none">{item.title}</h3>
                                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-bold text-base">{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* Testimonials / Wall of Love */}
            <section className="py-32 px-4 bg-white dark:bg-slate-900 relative overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <Reveal width="100%">
                        <div className="text-center mb-24 space-y-4">
                            <h3 className="text-indigo-600 font-black text-xs uppercase tracking-[0.3em]">Social Proof</h3>
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leadning-none font-black">Wall of Love</h2>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">Real stories from engineers and data scientists using Toeasy AI.</p>
                        </div>
                    </Reveal>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { name: 'Alex Rivera', role: 'Head of Data', company: 'FinTech Corp', quote: 'Toeasy has completely transformed how we handle our financial data. What used to take days of manual cleaning now takes minutes.', avatar: 'AR' },
                            { name: 'Sarah Chen', role: 'Senior Architect', company: 'NextScale', quote: 'The AI orchestration is spooky good. It understood our messy schema instantly and suggested fixes I hadn\'t even thought of.', avatar: 'SC' },
                            { name: 'Marcus Thorne', role: 'Startup Founder', company: 'DataFlow', quote: 'Finally, a data tool that doesn\'t require a PhD to use. We were up and running with 3 dashboards in less than an hour.', avatar: 'MT' },
                            { name: 'Elena Rodriguez', role: 'BI Analyst', company: 'Global Logistics', quote: 'The natural language playground is a game changer. I can just ask "What\'s our monthly growth?" and get the chart instantly.', avatar: 'ER' },
                            { name: 'David Park', role: 'Backend Engineer', company: 'SaaS Builder', quote: 'Cleanest API integration I\'ve seen. Highly recommended for teams who actually care about data quality.', avatar: 'DP' },
                            { name: 'Jessica Wu', role: 'Product Manager', company: 'Innovate AI', quote: 'Toeasy AI is the data operating system we were missing. Pure efficiency.', avatar: 'JW' }
                        ].map((testi, idx) => (
                            <Reveal key={idx} delay={0.1 * idx}>
                                <motion.div
                                    whileHover={{ y: -10 }}
                                    className="p-10 rounded-[40px] bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/30 transition-all shadow-sm group h-full"
                                >
                                    <div className="flex items-center gap-5 mb-8">
                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-base font-black shadow-xl group-hover:scale-110 transition-transform">
                                            {testi.avatar}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-slate-900 dark:text-white text-lg tracking-tight leading-none mb-1">{testi.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest leading-none">{testi.role}</p>
                                            <p className="text-[11px] text-indigo-500 font-black uppercase tracking-widest leading-none mt-1">{testi.company}</p>
                                        </div>
                                    </div>
                                    <blockquote className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed font-bold italic opacity-90 group-hover:opacity-100 transition-opacity">
                                        "{testi.quote}"
                                    </blockquote>
                                    <div className="mt-8 flex gap-1 items-center">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <svg key={s} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                                        ))}
                                        <span className="ml-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Verified Review</span>
                                    </div>
                                </motion.div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 px-4 overflow-hidden relative">
                <Reveal width="100%">
                    <div className="max-w-6xl mx-auto rounded-[60px] bg-indigo-600 p-16 md:p-32 text-center text-white relative shadow-[0_50px_100px_-30px_rgba(79,70,229,0.6)]">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent opacity-50"></div>
                        <div className="relative space-y-10">
                            <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-none">Ready to clean your data?</h2>
                            <p className="text-indigo-100 text-xl font-bold max-w-2xl mx-auto opacity-90">Join 500+ teams automating their data governance today. No credit card required.</p>
                            <div className="pt-8">
                                <Link
                                    to="/signup"
                                    className="inline-block px-14 py-6 rounded-3xl bg-white text-indigo-600 font-black shadow-2xl transition-all hover:scale-110 active:scale-95 text-2xl hover:shadow-white/20"
                                >
                                    Get started for free
                                </Link>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </section>
        </div>
    );
};

export default LandingPage;
