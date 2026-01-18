import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface PublicLayoutProps {
    children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 glass border-b border-white/20 dark:border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-indigo-500/30">
                                T
                            </div>
                            <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">
                                Toeasy<span className="text-indigo-600">.AI</span>
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <Link to="/" className="text-sm font-semibold hover:text-indigo-600 transition-colors">Features</Link>
                            <Link to="/" className="text-sm font-semibold hover:text-indigo-600 transition-colors">How it Works</Link>
                            <Link to="/contact" className="text-sm font-semibold hover:text-indigo-600 transition-colors">Contact Us</Link>
                        </div>

                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                Sign In
                            </Link>
                            <Link
                                to="/signup"
                                className="px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
                            >
                                Get Started
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 px-4">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
                    <div className="space-y-4 col-span-1 md:col-span-2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                                T
                            </div>
                            <span className="font-black text-lg tracking-tight text-slate-900 dark:text-white">
                                Toeasy<span className="text-indigo-600">.AI</span>
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
                            The next generation of AI-powered data governance. Clean, visualize, and analyze your data with unprecedented ease.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Legal</h4>
                        <ul className="space-y-2">
                            <li><Link to="/terms" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Terms & Conditions</Link></li>
                            <li><Link to="/privacy" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Privacy Policy</Link></li>
                            <li><Link to="/refunds" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Cancellations & Refunds</Link></li>
                        </ul>
                    </div>

                    <div className="space-y-4">
                        <h4 className="font-black text-xs uppercase tracking-widest text-slate-400 dark:text-slate-500">Support</h4>
                        <ul className="space-y-2">
                            <li><Link to="/contact" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Contact Us</Link></li>
                            <li><Link to="/contact" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">FAQ</Link></li>
                            <li><Link to="/contact" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Help Center</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-slate-400">© 2026 Toeasy AI. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><span className="sr-only">Twitter</span><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" /></svg></a>
                        <a href="#" className="text-slate-400 hover:text-indigo-600 transition-colors"><span className="sr-only">LinkedIn</span><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554V14.89c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg></a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default PublicLayout;
