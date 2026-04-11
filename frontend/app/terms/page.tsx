import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Terms of Service</h1>
        
        <div className="glass-card p-8 space-y-6 text-[#94a3b8] leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing BOGA Daily +500, you agree to comply with and be bound by
              these Terms of Service. If you do not agree, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account password. 
              Accounts are for individual use only and may not be shared.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Usage Restrictions</h2>
            <p>
              You agree not to scrape, automatedly harvest, or redistribute 
              BOGA signals, scores, or AI summaries without express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Service Modifications</h2>
            <p>
              We reserve the right to modify or discontinue any part of the service 
              at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Termination</h2>
            <p>
              We may suspend or terminate your account if we suspect fraudulent 
              activity or a violation of these terms.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
