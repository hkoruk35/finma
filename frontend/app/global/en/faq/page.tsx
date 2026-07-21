import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ) - BOGASTOCK",
  description: "Find answers to the most common questions about BOGASTOCK, our BOGA AI, and trend stock strategies.",
  alternates: { canonical: "https://bogastock.com/global/en/faq" },
};

export default function EnFAQPage() {
  const faqs = [
    {
      question: "1. What exactly is BOGASTOCK, and what does it do for me?",
      answer: "BOGASTOCK is a financial technology platform that uses artificial intelligence (BOGA AI) and advanced mathematical algorithms to scan thousands of stocks across major US exchanges (NYSE, NASDAQ, AMEX). Our goal is to cut through the noise of cluttered charts and indicators to identify, score, and deliver a clean watchlist of the top 20–30 trend stock candidates based on technical and fundamental data. We help you make rational, data-driven trading decisions."
    },
    {
      question: "2. Do you provide direct buy or sell recommendations?",
      answer: "Absolutely not. We are not a registered investment advisory firm, nor do we provide personalized financial advice. BOGASTOCK is a software platform driven entirely by mathematical algorithms. Our system will never tell you \"buy at price X\" or \"sell at price Y.\" Instead, we highlight strong potential candidates based on strict technical and fundamental criteria and provide AI-driven analysis reports. Executing trades, managing risk, and sizing positions are entirely your responsibility."
    },
    {
      question: "3. I’m a new member. Can I try the platform for free?",
      answer: "Yes! Every new member gets a 7-day Free Trial. During this trial period, you will have complete, transparent access to all active trend stock trades, watchlists, and chart analyses so you can experience and test the platform’s performance firsthand."
    },
    {
      question: "4. Why do you require card details for the free trial? Will I be charged immediately?",
      answer: "No, you will not be charged anything during your 7-day trial. We request billing information simply to ensure an uninterrupted experience if you choose to remain a member after your trial ends. You can easily cancel your subscription directly from your dashboard at any time during the trial without paying a dime."
    },
    {
      question: "5. Do you store my credit card information? Is my data secure?",
      answer: "Your security is our absolute priority. We do not store or process any credit card details on our own servers. All transactions are handled securely through Stripe—one of the world’s most trusted, encrypted, and secure payment processors."
    },
    {
      question: "6. What are Trending Stocks? I’m completely new to this.",
      answer: "Trending Stocks is a strategy aimed at capturing strong directional price moves in a stock over a period of a few days to a few weeks. It is ideal for those who don’t have the time to watch the market all day long but also don't want to tie up their capital in long-term investments. BOGASTOCK is specifically calibrated to spot these short-to-medium-term moves. However, like any form of trading, it involves real market risk and the potential loss of capital."
    },
    {
      question: "7. Are the recommended stocks ready to trade immediately? How should I enter?",
      answer: "The candidates featured on our \"Trending Stocks\" list are technically primed and structurally strong. However, to maximize profitability and lower your risk, we provide additional guidance on using our 15-minute (15m) chart structures to identify precise entry triggers and patterns. These fine-tuned entry strategies help protect you from potential false signals."
    },
    {
      question: "8. What is the difference between the \"Watchlist\" and the \"Trend List\"?",
      answer: "Watchlist: Features high-potential candidates that have hit our algorithms' radar but have not yet achieved a clean breakout or reached a safe, validated entry level.\n\nTrend List: Features the highest-conviction ideas that have successfully graduated from the Watchlist by securing all necessary technical, volume, and momentum confirmations for active trading."
    },
    {
      question: "9. How do the Interactive Charts and BOGA AI analysis help me?",
      answer: "On our stock detail page, we provide clean, simplified interactive charts built to keep things readable. BOGA AI analyzes these charts to map out objective trading plans, defining clear entry zones, profit targets, and stop-loss levels. You review these insights and manage your trades based on your personal risk tolerance and position sizing."
    },
    {
      question: "10. Does BOGA AI ever make mistakes? How does it improve?",
      answer: "Yes, it can. There is no such thing as an infallible financial system or AI; markets are inherently uncertain. However, BOGA AI uses a proprietary Large Language Model (LLM) framework combined with machine learning. It continuously analyzes the outcome of every trade (both wins and losses) to refine its parameters. Our goal is to adapt to shifting market conditions as fast as possible."
    },
    {
      question: "11. Are the charts cluttered with too many confusing lines and indicators?",
      answer: "No! The core philosophy of BOGASTOCK is to eliminate clutter, noise, and confusion. Instead of overwhelming you with technical jargon, we deliver clean, straightforward charts and highly readable metrics. Even if you are relatively new to market analysis, our AI-generated reports write out the data in plain, easy-to-understand English."
    },
    {
      question: "12. Is your data real-time or delayed?",
      answer: "Our technical data feeds update hourly with a standard 15-minute delay. Because BOGASTOCK is purely focused on trend stocks (multi-day or multi-week moves), tick-by-tick real-time data is unnecessary. Hourly updates are more than sufficient to produce stable, high-quality, and stress-free analyses."
    },
    {
      question: "13. There are thousands of stocks out there. How do I know which one to choose?",
      answer: "This is where BOGASTOCK does the heavy lifting for you. Our algorithm automatically scans over 6,000 stocks across the NYSE, NASDAQ, and AMEX every single day. We filter out the noise using strict volume and liquidity checks, narrowing the list down to an average of just 20–30 high-quality candidates. You don't have to waste hours searching for a needle in a haystack."
    },
    {
      question: "14. What does \"Tracking Smart Money\" mean?",
      answer: "In the stock market, the real force behind major price movements comes from large institutional funds and investment banks (often referred to as \"Smart Money\"). Our algorithm tracks daily capital flows and volume spikes to identify when these institutional players are quietly accumulation or distribution positions, allowing us to align our trades with the path of least resistance."
    },
    {
      question: "15. What is the \"Five-Tier Rating System\"?",
      answer: "The BOGASTOCK scoring engine grades every candidate based on technical and fundamental metrics, placing them into five distinct categories: High Conviction, Positive Bias, Neutral (Wait), Negative Bias, and Underperformance. This gives you instant clarity on the mathematical strength backing each setup."
    },
    {
      question: "16. How is the technical score of a stock calculated?",
      answer: "Our technical score is a weighted average of proven indicators calibrated specifically for the US markets. This includes RSI, MACD, Relative Volume, Exponential Moving Average (EMA) crossovers, ADX trend strength, and Bollinger Band squeezes. We rely on a multi-factor confirmation process rather than any single indicator."
    },
    {
      question: "17. Do you only use technical analysis? What about earnings and balance sheets?",
      answer: "Fundamentals are incredibly important. Our system pairs technical setups with a robust \"Fundamental and Sector Layer.\" We analyze and compare key metrics such as P/E ratios, Free Cash Flow (FCF) yields, gross profit margins, and revenue growth momentum against sector averages. This ensures we prioritize companies that possess both strong charts and healthy financials."
    },
    {
      question: "18. Does BOGASTOCK only focus on US markets? Why?",
      answer: "Yes, our platform is 100% focused on the US Stock Markets (NYSE, NASDAQ, AMEX). This is because the US market offers the deepest liquidity, the tightest spreads, and the most reliable structures for algorithmic and systematic trend-following. All our scoring criteria, weights, and AI models are custom-calibrated for this specific market dynamic."
    },
    {
      question: "19. Is there a risk of losing money when trading with this system?",
      answer: "Yes, absolutely. Any system promising guaranteed profits in financial markets is not being honest. BOGA AI’s historical win rates and performance statistics are based on past data, which does not guarantee future results. You should always practice proper risk management and never risk more capital than you can afford to lose."
    },
    {
      question: "20. Am I required to use a \"Stop Loss\"?",
      answer: "Yes, absolutely! Rule number one of the BOGASTOCK philosophy is: \"Never open a trade without a Stop Loss.\" Markets can move unpredictably at any moment. The only way to protect your trading capital from severe drawdowns is to pre-determine exactly where you will exit if the trade goes against you, and stick to that plan. Plan your trade, trade your plan, and leave emotions out of it."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="en" />
      
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Frequently Asked Questions (FAQ)
          </h1>
          <p className="text-[#64748b] text-lg">
            Everything you need to know about how BOGASTOCK and BOGA AI work.
          </p>
        </div>

        <div className="space-y-6">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-6 hover:border-[#3b82f6]/50 transition-colors">
              <h3 className="text-lg font-bold text-white mb-3 leading-snug">
                {faq.question}
              </h3>
              <div className="text-[#94a3b8] text-sm md:text-base leading-relaxed space-y-4">
                {faq.answer.split('\n\n').map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <Footer locale="en" />
    </div>
  );
}
