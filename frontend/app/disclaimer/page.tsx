import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Legal & Compliance</h1>
        
        <div className="glass-card p-8 space-y-12 text-[#94a3b8] leading-relaxed">
          {/* Section 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">1. Not Financial Advice</h2>
            <p>
              FinMA Daily 100 is an automated informational service. The content provided on this platform, 
              including but not limited to proprietary FinMA AI-generated analyses, scores, and trading signals 
              (STRONG BUY, BUY, etc.), is for informational purposes only. It does NOT constitute financial, 
              investment, or professional advice. We are not a registered investment advisor (RIA), broker-dealer, 
              or financial fiduciary. Always consult with a licensed financial professional before making 
              any investment decisions.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">2. High Risk Disclosure</h2>
            <p>
              Trading US equities involve a high degree of risk and the potential for significant loss of capital. 
              Our AI signals are experimental and based on historical data patterns which do not guarantee 
              future outcomes. We provide no warranty regarding the profitability or success of any signal 
              provided. Use the information at your own risk.
            </p>
          </section>

          {/* Section 4 (Relabeled as 3 in flow but user wants specific sections) */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">3. Data Privacy (CCPA/GDPR Compliance)</h2>
            <p>
              We prioritize user privacy. FinMA Daily 100 only collects email addresses for account 
              authentication purposes via secure third-party providers. We do NOT sell user data to 
              third parties. Members have the right to request full account and data deletion at any 
              time through our settings or contact form.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-4">4. Advertising & Neutrality Disclosure</h2>
            <p>
              Third-party advertisements may be displayed on this platform to support our free membership tier. 
              FinMA maintains strict separation between advertising and analysis; advertisers do not have 
              influence over the FinMA AI scoring engine, signal generation, or stock selection process.
            </p>
          </section>

          <section className="pt-8 border-t border-[#1e2a3a]">
            <p className="text-sm italic font-medium text-[#64748b]">
              Last Updated: April 2026. By using the FinMA Daily 100 platform, you acknowledge 
              that you have read, understood, and voluntarily agreed to all terms outlined above.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
