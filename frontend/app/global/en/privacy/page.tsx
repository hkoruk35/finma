import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "https://bogastock.com/global/en/privacy" }
};


export default function PrivacyPageEn() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Privacy Policy & Global Data Security Standards</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Our Data Security Commitment
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis) is an automated <strong className="text-white">technical analysis and decision-support platform</strong>. User data privacy and information security are fundamental to our architecture.
            </p>
            <p className="text-slate-300">
              In accordance with Google Data Security Principles, our platform strictly operates under the principles of <strong className="text-white">Data Minimization</strong> and <strong className="text-white">Privacy by Design</strong>.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Global Regulatory Compliance (USA, EU, Latin America, Asia, Turkey)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> maintains full compliance with international privacy laws across all regions we operate:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300 ml-2">
              <li><strong className="text-white">European Union (EU):</strong> General Data Protection Regulation (<strong className="text-white">GDPR</strong>) & ePrivacy Directive.</li>
              <li><strong className="text-white">United States (USA):</strong> California Consumer Privacy Act (<strong className="text-white">CCPA / CPRA</strong>) & state standards.</li>
              <li><strong className="text-white">Latin America:</strong> Brazil Lei Geral de Proteção de Dados (<strong className="text-white">LGPD</strong>), Mexico (<strong className="text-white">LFPDPPP</strong>), and Argentina (<strong className="text-white">Law 25.326</strong>).</li>
              <li><strong className="text-white">Asia-Pacific:</strong> South Korea (<strong className="text-white">PIPA</strong>), Japan (<strong className="text-white">APPI</strong>), Singapore/Malaysia (<strong className="text-white">PDPA</strong>), India (<strong className="text-white">DPDP</strong>), and Indonesia (<strong className="text-white">PDP Law</strong>).</li>
              <li><strong className="text-white">Turkey:</strong> Personal Data Protection Law No. 6698 (<strong className="text-white">KVKK</strong>).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Data Collection & Purpose
            </h2>
            <p className="mb-4 text-slate-300">
              Via Google and Supabase OAuth 2.0 authentication, we collect only essential minimal personal data (email address, name) required strictly for secure account management and subscription access.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. No Sale of Personal Data
            </h2>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com does not sell, lease, or monetize personal user data to any third-party data brokers or advertisers under any circumstances.</strong>
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Encryption & Security Infrastructure
            </h2>
            <p className="text-slate-300">
              All data transmissions are protected via end-to-end <strong className="text-white">TLS 1.3 / SSL 256-bit encryption</strong>. Data at rest is encrypted using <strong className="text-white">AES-256</strong> standards.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. User Rights & Right to Erasure
            </h2>
            <p className="text-slate-300">
              Users retain full ownership of their data, including rights to access, export, or permanently delete all personal records (<strong className="text-white">Right to be Forgotten</strong>) at any time.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              7. Advertising, Cookies & Google AdSense
            </h2>
            <p className="mb-4 text-slate-300">
              BogaStock.com uses <strong className="text-white">Google AdSense</strong> to display advertisements on this website. As a third-party vendor, Google uses cookies to serve ads based on a user&apos;s prior visits to this website or other websites on the Internet. Google&apos;s use of advertising cookies enables it and its partners to serve ads to our users based on their visits to BogaStock.com and/or other sites.
            </p>
            <p className="text-slate-300">
              Users may opt out of personalized advertising by visiting{" "}
              <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">Google Ads Settings</a>
              {" "}or{" "}
              <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-[#38bdf8] hover:underline">www.aboutads.info</a>.
            </p>
          </section>

          {/* Section 8 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Global Statement</h2>
            <p className="text-xs text-slate-400">
              By using BogaStock.com, you accept this Privacy Policy and international data security standards.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Last Updated: August 4, 2026 | BogaStock.com Data Privacy Management
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
