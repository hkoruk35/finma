import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  alternates: {
    canonical: "https://bogastock.com/global/en/disclaimer",
    languages: {
    en: "https://bogastock.com/global/en/disclaimer",
    es: "https://bogastock.com/global/es/disclaimer",
    fr: "https://bogastock.com/global/fr/disclaimer",
    id: "https://bogastock.com/global/id/disclaimer",
    pt: "https://bogastock.com/global/pt/disclaimer",
    tr: "https://bogastock.com/global/tr/disclaimer",
    "x-default": "https://bogastock.com/global/en/disclaimer",
    },
  },
};


export default function DisclaimerPageEn() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Legal Disclaimers, Regulatory Compliance & Liability Statement</h1>

        <div className="glass-card p-8 space-y-10 text-slate-200 leading-relaxed rounded-2xl border border-[#1e2a3a] bg-[#0d131f]/90">
          
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              1. Technical Analysis & Decision Support Platform Statement (Not Investment Advice)
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> is an automated <strong className="text-white">technical analysis and decision-support platform</strong> driven by proprietary quantitative algorithms and artificial intelligence. Our system scans global financial markets to detect technical opportunities and present decision-support analytics to users.
            </p>
            <p className="text-slate-300">
              All content, charts, AI scores, signals, and metrics provided on BogaStock.com are strictly for general informational, educational, and technical analytical purposes. Nothing on BogaStock.com constitutes investment advice, portfolio management, or personal financial recommendations. <strong className="text-white">BogaStock.com</strong> is not a Registered Investment Adviser (RIA) or Broker-Dealer under the U.S. Investment Advisers Act of 1940, nor is it a licensed financial institution under EU or global financial regulations. No fiduciary relationship is established between BogaStock.com and its users. Always consult a licensed financial professional before making investment decisions.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              2. Global Markets Coverage & High-Risk Warning
            </h2>
            <p className="mb-4 text-slate-300">
              Trading securities across global capital markets — including <strong className="text-white">United States (NYSE, NASDAQ, S&P 500, Dow, Russell 2000)</strong>, <strong className="text-white">European Exchanges (DAX, FTSE 100, CAC40, IBEX35, STOXX50)</strong>, <strong className="text-white">Asian Exchanges (Nikkei 225, SSE, HSI, SENSEX, NIFTY 50)</strong>, and <strong className="text-white">Latin American Exchanges (S&P Latam 40, S&P Latam BMI, IBOVESPA, IGCX, IBXX)</strong>, as well as Forex, Commodities, and Crypto — carries high volatility and significant risk of capital loss.
            </p>
            <p className="text-slate-300">
              Algorithmic data and historical indicators displayed on BogaStock.com do not guarantee future profitability or market performance. All trading decisions executed based on BogaStock.com information are made solely at your own risk and discretion.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              3. European Union (EU) Laws & Regulatory Compliance
            </h2>
            <p className="mb-4 text-slate-300">
              <strong className="text-white">BogaStock.com</strong> operates in strict adherence to European Union (EU) financial market standards, including guidelines from <strong className="text-white">ESMA (European Securities and Markets Authority)</strong>, <strong className="text-white">MiFID II (Markets in Financial Instruments Directive)</strong> transparency rules, and <strong className="text-white">MAR (EU Market Abuse Regulation No 596/2014)</strong>.
            </p>
            <p className="text-slate-300">
              Our platform does not engage in market manipulation, insider dealing, or unauthorized advisory services. All algorithmic scanners execute through objective, rule-based mathematical criteria.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              4. Data Privacy & Global Compliance (GDPR & CCPA)
            </h2>
            <p className="text-slate-300">
              User privacy is guaranteed under <strong className="text-white">BogaStock.com</strong>. We comply fully with the European Union General Data Protection Regulation (<strong className="text-white">GDPR</strong>) and the California Consumer Privacy Act (<strong className="text-white">CCPA</strong>). We do not sell or lease personal data to third-party data brokers.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-semibold text-white mb-4 text-[#38bdf8]">
              5. Independence & Objectivity
            </h2>
            <p className="text-slate-300">
              Third-party advertisements or sponsorships displayed on <strong className="text-white">BogaStock.com</strong> have zero influence or control over our AI quantitative scoring algorithms, technical analysis scans, or data outputs.
            </p>
          </section>

          {/* Section 6 */}
          <section className="pt-6 border-t border-[#1e2a3a]">
            <h2 className="text-lg font-semibold text-white mb-2">User Acknowledgement</h2>
            <p className="text-xs text-slate-400">
              By using BogaStock.com, you acknowledge that you have read, understood, and agreed to all legal terms, EU compliance statements, and disclaimers outlined above.
            </p>
            <p className="mt-4 text-xs font-mono text-[#38bdf8]">
              Last Updated: August 18, 2026 | BogaStock.com Technical Analysis & Decision Support Platform
            </p>
          </section>

        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
