import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms",
  alternates: { canonical: "https://bogastock.com/global/en/terms" }
};


export default function TermsPageEn() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Terms of Service & User Agreement</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Acceptance of Terms & Corporate Identity
            </h2>
            <p className="mb-4 text-slate-300">
              By accessing or creating an account on <strong className="text-white">BogaStock.com</strong>, you agree to be bound by these Terms of Service and User Agreement.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> (Blue One Global Analysis) is an automated <strong className="text-white">technical analysis and decision-support platform</strong> powered by proprietary quantitative algorithms and artificial intelligence models.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Scope of Service & Non-Investment Advice Statement
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> scans global financial markets using quantitative algorithms to detect technical opportunities and provide decision-support data for users.
            </p>
            <p className="text-slate-300">
              Nothing published on BogaStock.com — including interactive charts, indicator signals, AI scores, or market metrics — constitutes <strong className="text-white">investment advice, portfolio management, or personalized financial recommendations</strong>. BogaStock.com is not a Registered Investment Adviser (RIA) or Broker-Dealer under U.S. SEC regulations or European Union financial authorities. No fiduciary or advisory relationship is established.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. Global Markets & EU Laws (ESMA, MiFID II, MAR) Compliance
            </h2>
            <p className="mb-4 text-slate-300">
              Our platform covers global capital markets: <strong className="text-white">U.S. Markets (NYSE, NASDAQ, S&P 500, Dow, Russell)</strong>, <strong className="text-white">European Exchanges (DAX, FTSE 100, CAC40, STOXX50)</strong>, <strong className="text-white">Asian Exchanges (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong>, and <strong className="text-white">Latin American Exchanges (S&P Latam 40, IBOVESPA)</strong>, alongside Forex, Commodities, and Crypto.
            </p>
            <p className="text-slate-300">
              <strong className="text-white">BogaStock.com</strong> operates in strict adherence to European Union (EU) financial market standards, including <strong className="text-white">ESMA</strong> guidelines, <strong className="text-white">MiFID II</strong> directive transparency, and <strong className="text-white">MAR (EU Market Abuse Regulation No 596/2014)</strong>. We do not engage in market manipulation or unauthorized portfolio direction.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Account Security & Intellectual Property Restrictions
            </h2>
            <p className="mb-4 text-slate-300">
              User accounts are strictly personal and non-transferable. You are responsible for keeping your login credentials confidential.
            </p>
            <p className="text-slate-300">
              All proprietary algorithms, AI scoring engine data, software code, and design components on BogaStock.com are protected by intellectual property laws. Automated data scraping, extraction, copying, or commercial redistribution without prior written consent is strictly prohibited.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Data Privacy (GDPR & CCPA)
            </h2>
            <p className="text-slate-300">
              We process user data in full compliance with the European Union General Data Protection Regulation (<strong className="text-white">GDPR</strong>) and the California Consumer Privacy Act (<strong className="text-white">CCPA</strong>). BogaStock.com never sells or leases personal data to third-party data brokers.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              6. Limitation of Liability & Service Modifications
            </h2>
            <p className="text-slate-300">
              Trading financial markets involves high volatility and risk of capital loss. All decisions made using BogaStock.com decision-support data remain the sole personal responsibility of the user. BogaStock.com reserves the right to modify or update service features and terms at any time.
            </p>
          </section>

          {/* Section 7 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">Legal Execution</h2>
            <p className="text-xs text-slate-400">
              By continuing to use BogaStock.com, you acknowledge and agree to these terms and regulatory standards.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Last Updated: August 4, 2026 | BogaStock.com Technical Analysis & Decision Support Platform
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
