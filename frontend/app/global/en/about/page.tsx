import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "About BogaStock — Our Story, Technology, and Vision",
  description: "The story behind BogaStock: from AFK Data Sistemleri's 2018 beginnings in California, to BogaStock.com's launch into finance in 2021. Today, an AI platform serving users in 70+ countries, around the clock.",
  alternates: {
    canonical: "https://bogastock.com/global/en/about",
    languages: {
      "en-US": "https://bogastock.com/global/en/about",
      "es-ES": "https://bogastock.com/global/es/about",
      "fr-FR": "https://bogastock.com/global/fr/about",
      "pt-PT": "https://bogastock.com/global/pt/about",
      "tr-TR": "https://bogastock.com/global/tr/about",
    },
  },
  openGraph: {
    title: "About BogaStock — Our Story, Technology, and Vision",
    description: "From AFK Data Sistemleri's 2018 beginnings to BogaStock, now serving users in 70+ countries.",
    url: "https://bogastock.com/global/en/about",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">Our Story</p>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            From an Autonomous-Vehicle Idea<br />
            <span className="text-[#3b82f6]">to Today's BogaStock.</span>
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            BogaStock didn't appear overnight. It grew out of years of data-processing experience gathered by a small team in California that started out working on self-driving cars.
          </p>
        </div>

        {/* 2018 - Origin */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#3b82f6]">2018</span>
            <h2 className="text-xl font-bold text-white">A Start in California</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            BogaStock's story actually begins with autonomous vehicles, not finance. Founded in California in 2018, AFK Data Sistemleri (AFK DaSYS) spent its early years building data-processing and decision-support systems for self-driving cars. That know-how now powers real-time Smart City simulations across more than 1,000 cities in 48 U.S. states, as of 2025.
          </p>
        </div>

        {/* 2021 - BogaStock born */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]"></div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-black text-[#8b5cf6]">2021</span>
            <h2 className="text-xl font-bold text-white">The Path Crosses Into Finance</h2>
          </div>
          <p className="text-white/70 leading-relaxed">
            In 2021, the AFK DaSYS team decided to point that same deep data-processing discipline — making sense of huge volumes of data and turning it into real-time decisions — toward an entirely different challenge: financial markets. That's how BogaStock.com came to life, with a simple goal: make following thousands of US stocks feel less like a technical chore, and more like something anyone can understand.
          </p>
        </div>

        {/* Continuous learning */}
        <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#06b6d4] to-[#22c55e]"></div>
          <h2 className="text-xl font-bold text-white mb-4">A System That Never Stops Learning</h2>
          <p className="text-white/70 leading-relaxed">
            BogaStock's AI hasn't stayed the same since day one, and it won't in the future either. Every time the system rolls out a new analysis or trading model, it goes through its own retraining cycle — so the more the platform is used, the more experience it gains, and the sharper it becomes over time. This progress continues alongside{" "}
            <a href="https://www.afknexro.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline">AFK Nexro AI</a>
            , a sister AI system focused on Smart City and autonomous-vehicle technology, as part of a shared R&D culture.
          </p>
        </div>

        {/* Today */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white text-center mb-10">BogaStock Today</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">70+</div>
              <p className="text-white/70 text-sm leading-relaxed">countries reached, with a system that runs around the clock.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">6,000+</div>
              <p className="text-white/70 text-sm leading-relaxed">US stocks and ETFs scanned and evaluated every single day.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">5 Languages</div>
              <p className="text-white/70 text-sm leading-relaxed">on our website, running on our own databases and data centers.</p>
            </div>
            <div className="glass-card p-6">
              <div className="text-3xl font-black text-[#3b82f6] mb-2">30+ Languages</div>
              <p className="text-white/70 text-sm leading-relaxed">through Boga Copilot — natural conversation, adapted to everyday use.</p>
            </div>
          </div>
        </div>

        {/* Mission */}
        <div className="glass-card p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <h2 className="text-2xl font-medium text-white mb-4">What We Believe</h2>
          <p className="text-white/80 max-w-2xl mx-auto italic leading-relaxed">
            "In a world increasingly run by algorithms, processing data correctly is only half the job — making it understandable matters just as much. At BogaStock, our goal is to turn complex market data into a clear path anyone can follow, so you can make your own decisions with confidence."
          </p>
        </div>
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
