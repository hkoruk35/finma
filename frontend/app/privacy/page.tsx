import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Privacy Policy</h1>
        
        <div className="glass-card p-8 space-y-6 text-[#94a3b8] leading-relaxed">
          <p>Last updated: April 2026</p>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>
              We collect minimal personal information to provide our services. 
              This includes your email address when you register for an account, 
              and technical data like IP addresses and browser cookies to maintain 
              your session and analyze site performance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Data</h2>
            <p>
              Your data is used to:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
               <li>Manage your member account and watchlist settings.</li>
               <li>Send daily market digests or critical alerts (if opted-in).</li>
               <li>Improve our AI scoring algorithms based on aggregate usage patterns.</li>
               <li>Display relevant financial advertisements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Data Sharing</h2>
            <p>
              We do not sell your personal data to third parties. 
              Aggregated, anonymized data may be shared with our advertising 
              partners to facilitate ad delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Security</h2>
            <p>
              We use industry-standard encryption to protect your account. 
              However, no method of electronic storage or transmission is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Your Rights</h2>
            <p>
              You can request to view, correct, or delete your personal data 
              at any time by contacting us at contact@bogastock.com.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
