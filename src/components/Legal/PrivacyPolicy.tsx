import React from 'react';

const PrivacyPolicy: React.FC = () => {
    return (
        <div className="py-20 px-4 max-w-4xl mx-auto space-y-12">
            <div className="space-y-4 text-center">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white">Privacy Policy</h1>
                <p className="text-slate-500 font-medium italic">Last Updated: January 18, 2026</p>
            </div>

            <div className="space-y-10 text-slate-700 dark:text-slate-300 leading-relaxed">
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">1. Information We Collect</h2>
                    <p>
                        We collect several different types of information for various purposes to provide and improve our Service to you:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Personal Data:</strong> Email address, first name, and last name.</li>
                        <li><strong>Usage Data:</strong> Information on how the Service is accessed and used.</li>
                        <li><strong>Cookies & Tracking:</strong> We use cookies and similar tracking technologies to track activity on our Service.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">2. Use of Data</h2>
                    <p>Toeasy AI uses the collected data for various purposes:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>To provide and maintain our Service.</li>
                        <li>To notify you about changes to our Service.</li>
                        <li>To provide customer support.</li>
                        <li>To gather analysis or valuable information so that we can improve our Service.</li>
                        <li>To monitor the usage of our Service.</li>
                        <li>To detect, prevent and address technical issues.</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">3. Data Security</h2>
                    <p>
                        The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">4. Third-Party Service Providers</h2>
                    <p>
                        We may employ third-party companies and individuals to facilitate our Service ("Service Providers"), to provide the Service on our behalf, to perform Service-related services or to assist us in analyzing how our Service is used.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">5. Links To Other Sites</h2>
                    <p>
                        Our Service may contain links to other sites that are not operated by us. If you click on a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">6. Children's Privacy</h2>
                    <p>
                        Our Service does not address anyone under the age of 18 ("Children"). We do not knowingly collect personally identifiable information from anyone under the age of 18.
                    </p>
                </section>

                <div className="pt-12 border-t border-slate-200 dark:border-slate-800 text-center">
                    <p className="text-sm text-slate-500">For any privacy-related concerns, please contact our Data Protection Officer at <a href="mailto:privacy@Toeasy" className="text-indigo-600 font-bold hover:underline">privacy@Toeasy</a>.</p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
