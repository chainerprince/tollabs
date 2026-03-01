import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Icon from "@/components/ui/Icon";
import Link from "next/link";
import HomeStats from "@/components/home/HomeStats";

export default function HomePage() {
  return (
    <div className="bg-white text-toll-text min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <main className="flex-1 pt-32 pb-16 relative overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl hero-grid" />
          <svg className="absolute inset-0 w-full h-full opacity-30" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{ stopColor: "#2563EB", stopOpacity: 0 }} />
                <stop offset="50%" style={{ stopColor: "#2563EB", stopOpacity: 0.5 }} />
                <stop offset="100%" style={{ stopColor: "#2563EB", stopOpacity: 0 }} />
              </linearGradient>
            </defs>
            <path className="connect-line" d="M100,100 Q400,50 600,300 T1100,200" fill="none" stroke="url(#lineGradient)" strokeWidth="1.5" />
            <path className="connect-line" d="M-50,400 Q300,300 500,600 T1200,500" fill="none" stroke="url(#lineGradient)" strokeWidth="1.5" style={{ animationDuration: "40s" }} />
            <circle className="floating-node" cx="600" cy="300" r="4" fill="#3B82F6" />
            <circle className="floating-node-delayed" cx="200" cy="500" r="3" fill="#3B82F6" />
            <circle className="floating-node" cx="1000" cy="200" r="5" fill="#3B82F6" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-toll-blue-light border border-blue-100 text-toll-blue text-xs font-semibold uppercase tracking-wider mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            v2.0 Infrastructure Live
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 pb-2">
            Quant Excellence <br className="hidden md:block" />
            <span className="text-toll-blue font-serif italic font-normal">powered by</span> Modal.ai
          </h1>

          <p className="text-lg md:text-xl text-toll-text-light max-w-2xl mx-auto mb-10 leading-relaxed">
            Deploy high-frequency trading models on distributed GPUs. Backtest with institutional-grade data. Automate your strategy execution.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-toll-blue hover:bg-toll-blue-dark text-white rounded-lg font-semibold shadow-glow hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              Start Research
              <Icon name="arrow_forward" className="text-sm" />
            </Link>
            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-8 py-3.5 bg-white border border-gray-200 hover:border-toll-blue text-toll-text hover:text-toll-blue rounded-lg font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group"
            >
              Explore Strategies
              <Icon name="candlestick_chart" className="text-gray-400 group-hover:text-toll-blue transition-colors text-sm" />
            </Link>
          </div>

          {/* Stats — fetched from real API */}
          <HomeStats />
        </div>
      </main>

      {/* Features */}
      <section className="bg-toll-bg-alt py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "memory",
                title: "Infinite Compute",
                desc: "Scale your inference effortlessly. Run complex OS models on Modal GPUs with zero infrastructure overhead.",
                features: ["Auto-scaling A100s", "Python-native deployment"],
              },
              {
                icon: "history_edu",
                title: "Professional Backtesting",
                desc: "Validate your edge before risking capital. Test strategies on years of tick-level historical Forex and Stock data.",
                features: ["Tick-level granularity", "Slippage simulation"],
              },
              {
                icon: "payments",
                title: "Automated Payouts",
                desc: "Monetize your alpha. Secure profit-sharing distribution directly to your bank account powered by Stripe Connect.",
                features: ["Instant settlement", "Global bank support"],
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-white rounded-2xl p-8 border border-gray-100 shadow-soft hover:shadow-lg transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                  <Icon name={card.icon} className="text-toll-blue text-2xl" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
                <p className="text-toll-text-light leading-relaxed text-sm mb-6">
                  {card.desc}
                </p>
                <ul className="space-y-2 mb-6">
                  {card.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Icon name="check" className="text-green-500 text-sm" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
