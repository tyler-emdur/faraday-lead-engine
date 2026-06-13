import ChatWidget from "@/components/ChatWidget";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import QuickCaptureForm from "@/components/QuickCaptureForm";
import FloatingChat from "@/components/FloatingChat";
import StormBanner from "@/components/StormBanner";
import InsuranceEstimator from "@/components/InsuranceEstimator";
import ActivityTicker from "@/components/ActivityTicker";

const REVIEWS = [
  {
    name: "Sarah M.",
    city: "Longmont",
    text: "Faraday handled my entire hail damage claim. Brand new roof and I only paid my deductible. The whole process took 3 weeks.",
    stars: 5,
    service: "Hail Damage",
  },
  {
    name: "James R.",
    city: "Fort Collins",
    text: "Solar install was flawless. Team handled the city permit and Xcel paperwork completely. My bill dropped from $240 to $11.",
    stars: 5,
    service: "Solar",
  },
  {
    name: "Linda K.",
    city: "Aurora",
    text: "New windows cut my heating bill by 40%. Anna was super helpful in the chat and the team showed up exactly when they said.",
    stars: 5,
    service: "Windows",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Free Inspection",
    desc: "Our inspector comes to you — same day or next day. We document every bit of damage, top to bottom.",
  },
  {
    n: "2",
    title: "We File Your Claim",
    desc: "We handle all the paperwork, meet with your adjuster, and make sure nothing gets missed or lowballed.",
  },
  {
    n: "3",
    title: "You Pay Just Your Deductible",
    desc: "Insurance covers the rest. Most Front Range claims come in at $9,000–$22,000 fully covered.",
  },
];

const TRUST = [
  "Licensed & Insured in Colorado",
  "4.9★ Google (200+ reviews)",
  "BBB A+ Accredited",
  "We handle all insurance paperwork",
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "RoofingContractor",
  name: "Faraday Construction",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com",
  telephone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518",
  email: "info@faradayenterprises.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "4165 57th St",
    addressLocality: "Boulder",
    addressRegion: "CO",
    postalCode: "80301",
    addressCountry: "US",
  },
  areaServed: [
    "Denver, CO", "Boulder, CO", "Fort Collins, CO", "Colorado Springs, CO",
    "Longmont, CO", "Loveland, CO", "Aurora, CO", "Broomfield, CO",
    "Westminster, CO", "Arvada, CO", "Lakewood, CO", "Thornton, CO",
  ],
  description: "Colorado's trusted roofing, hail damage, solar, and window experts. Free inspections. We handle all insurance claims.",
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "200", bestRating: "5" },
};

export default function HomePage() {
  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";
  const email = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@faradayconstruction.com";

  return (
    <main className="min-h-screen bg-gray-950 pb-16 sm:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <ExitIntentPopup />
      <FloatingChat />

      {/* ─── NAV ─── */}
      <nav className="sticky top-0 z-40 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-black tracking-tight">FARADAY</span>
            <span className="text-gray-500 text-sm hidden sm:block">Construction</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <a href="#chat" className="hidden sm:block text-gray-400 hover:text-white text-sm transition-colors">
              Chat with Anna
            </a>
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 font-semibold text-sm px-3 py-1.5 rounded-lg transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
              </svg>
              {phone}
            </a>
          </div>
        </div>
      </nav>

      {/* Live storm urgency banner */}
      <StormBanner />

      {/* ─── HERO ─── */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-10 md:pt-16 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left — headline + trust */}
          <div>
            <div className="inline-flex items-center gap-1.5 bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Hail season is here — claim windows close fast
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-5 leading-[1.1]">
              Your Roof Damage<br />
              <span className="text-amber-500">May Already Be Paid For</span>
            </h1>

            <p className="text-gray-300 text-lg mb-7 leading-relaxed">
              Colorado homeowners average{" "}
              <span className="text-white font-semibold">$9,000–$22,000</span>{" "}
              in insurance-covered repairs. Free inspection — we handle all the paperwork.
              You pay only your deductible.
            </p>

            {/* Trust pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TRUST.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-300"
                >
                  <span className="text-amber-500 text-xs">✓</span>
                  {t}
                </span>
              ))}
            </div>

            {/* Live activity ticker */}
            <div className="mb-6">
              <ActivityTicker />
            </div>

            <p className="text-gray-600 text-sm">
              Prefer to call?{" "}
              <a href={`tel:${phone}`} className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                {phone}
              </a>
              {" "}— someone picks up.
            </p>
          </div>

          {/* Right — form */}
          <div className="bg-gray-900 border border-amber-500/25 rounded-2xl p-6 md:p-7 shadow-2xl shadow-black/40">
            <div className="mb-5">
              <h2 className="text-white font-bold text-xl mb-1">Get Your Free Inspection</h2>
              <p className="text-gray-400 text-sm">30 seconds. We call or text within the hour.</p>
            </div>
            <QuickCaptureForm source="hero_form" />
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section className="border-t border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-white font-bold">4.9</span>
            <span className="text-gray-500 text-sm">· 200+ Google reviews · Serving the Front Range since 2012</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REVIEWS.map((r) => (
              <div key={r.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex gap-0.5">
                  {[...Array(r.stars)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed flex-1">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center justify-between">
                  <p className="text-gray-500 text-xs font-medium">{r.name} · {r.city}, CO</p>
                  <span className="text-xs text-amber-500/70 bg-amber-500/10 px-2 py-0.5 rounded-full">{r.service}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">How It Works</h2>
          <p className="text-gray-400 max-w-md mx-auto text-sm">
            Most homeowners go from first call to approved claim in under 2 weeks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:gap-0 relative">
          {/* Connector line on desktop */}
          <div className="hidden md:block absolute top-8 left-[calc(16.6%+16px)] right-[calc(16.6%+16px)] h-px bg-gradient-to-r from-amber-500/30 via-amber-500/60 to-amber-500/30" />

          {STEPS.map((step, i) => (
            <div key={step.n} className="relative flex flex-col items-center text-center px-6 py-8">
              {/* Mobile connector */}
              {i < STEPS.length - 1 && (
                <div className="md:hidden absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-8 bg-amber-500/30" />
              )}
              <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xl mb-4 shadow-lg shadow-amber-500/20 relative z-10">
                {step.n}
              </div>
              <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA after steps */}
        <div className="text-center mt-10">
          <a
            href="#chat"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-amber-900/30"
          >
            Start with a Free Inspection
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
          <p className="text-gray-600 text-xs mt-3">No cost · No commitment · We come to you</p>
        </div>
      </section>

      {/* ─── INSURANCE ESTIMATOR ─── */}
      {/* Personalized dollar amount = highest conversion tool on the page */}
      <section className="border-t border-gray-800/60 bg-gray-950" id="estimate">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5 text-amber-400 text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Free Insurance Estimate — 30 Seconds
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              How Much Is Your Roof Damage Worth?
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Answer 4 quick questions. We'll show you an estimated insurance payout based on real Colorado claims.
            </p>
          </div>
          <InsuranceEstimator />
        </div>
      </section>

      {/* ─── ANNA CHAT ─── */}
      {/* Catches everyone who didn't fill the hero form — available 24/7 */}
      <section className="border-t border-gray-800/60 bg-gray-900/20" id="chat">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-sm">A</div>
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-emerald-400 text-sm font-medium">Anna is online now</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Still Have Questions?
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Anna answers in seconds — service costs, insurance questions, scheduling. Available 24/7.
            </p>
          </div>
          <ChatWidget source="website" />
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-800/60">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-amber-500 font-black text-lg mb-2">FARADAY</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Colorado&apos;s Front Range roofing, hail damage, windows, and solar experts.
                Serving homeowners since 2012.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Services</h4>
              <ul className="space-y-1.5 text-sm text-gray-500">
                <li>Hail Damage Repair</li>
                <li>Roof Replacement</li>
                <li>Windows &amp; Doors</li>
                <li>Solar Installation</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Contact</h4>
              <div className="space-y-1.5 text-sm text-gray-500">
                <p>
                  <a href={`tel:${phone}`} className="hover:text-amber-400 transition-colors">{phone}</a>
                </p>
                <p>
                  <a href={`mailto:${email}`} className="hover:text-amber-400 transition-colors">{email}</a>
                </p>
                <p>4165 57th St, Boulder CO 80301</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
            <span>© {new Date().getFullYear()} Faraday Construction. Licensed &amp; Insured in Colorado.</span>
            <div className="flex items-center gap-4">
              <a href="/blog" className="hover:text-gray-500 transition-colors">Blog</a>
              <a href="/storm" className="hover:text-gray-500 transition-colors">Storm Tracker</a>
              <a href="/admin" className="hover:text-gray-500 transition-colors">Admin</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── MOBILE STICKY CTA ─── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 border-t border-gray-800/80 backdrop-blur-sm">
        <div className="flex gap-2 px-4 py-3">
          <a
            href={`tel:${phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 border border-gray-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
            </svg>
            Call Now
          </a>
          <a
            href="#chat"
            className="flex-1 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm transition-colors"
          >
            Free Inspection
          </a>
        </div>
      </div>
    </main>
  );
}
