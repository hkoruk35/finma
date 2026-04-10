import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-16">
           <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">Financial Intelligence, Automated.</h1>
           <p className="text-xl text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
              FinMA Daily +500 combines technical precision with large language model analysis to give you a daily unfair advantage in the US stock market.
           </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
           <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/10 flex items-center justify-center text-[#3b82f6] mb-6">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                 </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Technical Hard Data</h3>
              <p className="text-[#64748b] text-sm leading-relaxed">
                 We scan 100 top-tier US equities every morning at 09:00 NY time. Our engine computes RSI, MACD, RVOL, EMA cross-multiples, and Bollinger Band Squeezer intensities to identify high-probability setups.
              </p>
           </div>
           <div className="glass-card p-8">
              <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] mb-6">
                 <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                 </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-4">AI-Driven Context</h3>
              <p className="text-[#64748b] text-sm leading-relaxed">
                 Numbers only tell half the story. We feed technical data, news sentiment, and fundamental metrics into Gemini 1.5 Flash to generate a "Human-Readable" summary of why a signal was generated.
              </p>
           </div>
        </div>

        <div className="glass-card p-10 text-center">
           <h2 className="text-2xl font-bold text-white mb-4">Our Mission</h2>
           <p className="text-[#94a3b8] max-w-2xl mx-auto italic">
              "To democratize institutional-grade financial analysis by leveraging the power of agentic AI, 
              making complex market movements easy to understand for every retail trader."
           </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
