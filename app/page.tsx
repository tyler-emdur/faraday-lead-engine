import ChatWidget from "@/components/ChatWidget";
import InsuranceEstimator from "@/components/InsuranceEstimator";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import QuickCaptureForm from "@/components/QuickCaptureForm";
import FloatingChat from "@/components/FloatingChat";
import StormBanner from "@/components/StormBanner";

const SERVICES = [
  {
    icon: "🌨️",
    title: "Hail Damage",
    desc: "Fast inspection and insurance claim handling after storms. Most repairs are fully covered.",
    accent: "border-red-800/50 hover:border-red-600/60",
    badge: "Most Popular",
    badgeColor: "bg-red-900/60 text-red-300",
  },
  {
    icon: "🏠",
    title: "Roofing",
    desc: "Full roof replacements, repairs, and inspections for Colorado's harsh weather seasons.",
    accent: "border-gray-800/60 hover:border-amber-600/40",
    badge: null,
    badgeColor: "",
  },
  {
    icon: "🪟",
    title: "Windows & Doors",
    desc: "Energy-efficient replacement windows and doors to cut heating costs and improve curb appeal.",
    accent: "border-gray-800/60 hover:border-amber-600/40",
    badge: null,
    badgeColor: "",
  },
  {
    icon: "☀️",
    title: "Solar",
    desc: "Custom solar installations with Colorado incentives. Save up to 80% on energy bills.",
    accent: "border-amber-800/40 hover:border-amber-500/50",
    badge: "Tax Credits Available",
    badgeColor: "bg-amber-900/60 text-amber-300",
  },
];

const TRUST = [
  { icon: "✓", text: "Licensed & Insured in Colorado" },
  { icon: "★", text: "4.9 Stars on Google (200+ reviews)" },
  { icon: "🏅", text: "BBB Accredited Business" },
  { icon: "📋", text: "We handle all insurance paperwork" },
];

const REVIEWS = [
  {
    name: "Sarah M.",
    city: "Longmont",
    text: "Faraday handled my entire hail damage claim. Got a brand new roof and only paid my deductible. Incredible service.",
    stars: 5,
  },
  {
    name: "James R.",
    city: "Fort Collins",
    text: "Solar install was flawless. Team was professional and the city permit process was handled completely by Faraday.",
    stars: 5,
  },
  {
    name: "Linda K.",
    city: "Aurora",
    text: "New windows cut my heating bill by 40%. The chat with Anna was super easy and the team showed up exactly when they said.",
    stars: 5,
  },
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "RoofingContractor",
  name: "Faraday Construction",
  alternateName: "Faraday Enterprises",
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
  geo: { "@type": "GeoCoordinates", latitude: 40.015, longitude: -105.2705 },
  areaServed: [
    "Denver, CO", "Boulder, CO", "Fort Collins, CO", "Colorado Springs, CO",
    "Longmont, CO", "Loveland, CO", "Aurora, CO", "Broomfield, CO",
    "Westminster, CO", "Arvada, CO", "Lakewood, CO", "Thornton, CO",
  ],
  description:
    "Colorado's trusted roofing, hail damage repair, solar installation, and window replacement experts. Free inspections. We handle all insurance claims.",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "200",
    bestRating: "5",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Home Exterior Services",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Hail Damage Repair & Insurance Claims" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Roof Replacement & Repair" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Solar Panel Installation" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "Replacement Windows & Doors" } },
    ],
  },
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

      {/* Nav */}
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-black tracking-tight">FARADAY</span>
            <span className="text-gray-400 text-sm hidden sm:block">Construction</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#chat" className="hidden sm:block text-gray-400 hover:text-white text-sm transition-colors">
              Chat with Anna
            </a>
            <a
              href={`tel:${phone}`}
              className="text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors"
            >
              {phone}
            </a>
          </div>
        </div>
      </nav>

      {/* Live storm urgency banner — appears automatically when recent hail is detected */}
      <StormBanner />

      {/* ─── HERO + QUICK FORM ─── */}
      {/* This is the above-the-fold conversion surface — optimized for cold ad traffic */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-8 md:pt-16 md:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

          {/* Left: headline + trust */}
          <div>
            <div className="inline-block bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              Hail Season Is Here — Claim Windows Close Fast
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Your Roof Damage<br />
              <span className="text-amber-500">May Already Be Covered</span>
            </h1>
            <p className="text-gray-400 text-lg mb-6 leading-relaxed">
              Colorado homeowners average <span className="text-white font-semibold">$9,000–$22,000</span> in insurance-covered repairs.
              Free inspection. We handle all the paperwork.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {TRUST.map(t => (
                <span
                  key={t.text}
                  className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-300"
                >
                  <span className="text-amber-500">{t.icon}</span>
                  {t.text}
                </span>
              ))}
            </div>
            {/* Phone fallback for people who just want to call */}
            <p className="text-gray-500 text-sm">
              Prefer to call?{" "}
              <a href={`tel:${phone}`} className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">
                {phone}
              </a>
            </p>
          </div>

          {/* Right: Quick Capture Form — name + phone + city + service, 30 seconds */}
          <div className="bg-gray-900 border border-amber-600/30 rounded-2xl p-6 shadow-xl shadow-black/40">
            <div className="mb-5">
              <h2 className="text-white font-bold text-xl mb-1">Get Your Free Inspection</h2>
              <p className="text-gray-400 text-sm">30 seconds. We call or text you within the hour.</p>
            </div>
            <QuickCaptureForm source="hero_form" />
          </div>
        </div>
      </section>

      {/* ─── INSURANCE VALUE ESTIMATOR ─── */}
      {/* For visitors who want to know their dollar amount before committing */}
      <section className="max-w-6xl mx-auto px-4 py-8" id="estimator">
        <div className="text-center mb-6">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            Want to Know Your Exact Coverage?
          </h2>
          <p className="text-gray-400 text-sm max-w-lg mx-auto">
            Answer 4 quick questions and see your estimated claim amount before we even show up.
          </p>
        </div>
        <InsuranceEstimator />
      </section>

      {/* Services */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Our Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map(s => (
            <div
              key={s.title}
              className={`bg-gray-900 border rounded-2xl p-5 transition-all duration-200 ${s.accent}`}
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-white text-lg">{s.title}</h3>
                {s.badge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badgeColor}`}>
                    {s.badge}
                  </span>
                )}
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ANNA CHAT ─── */}
      {/* For undecided visitors who want to ask questions before committing */}
      <section className="max-w-6xl mx-auto px-4 py-14" id="chat">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-3">
            Have Questions? Chat with <span className="text-amber-500">Anna</span>
          </h2>
          <p className="text-gray-400">
            Available 24/7. She&apos;ll answer anything and help you book your free inspection in minutes.
          </p>
        </div>
        <ChatWidget source="website" />
      </section>

      {/* Social Proof */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          What Colorado Homeowners Say
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {REVIEWS.map(r => (
            <div key={r.name} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex gap-0.5 mb-3">
                {Array(r.stars).fill(0).map((_, i) => (
                  <span key={i} className="text-amber-400 text-sm">★</span>
                ))}
              </div>
              <p className="text-gray-300 text-sm italic mb-3">&ldquo;{r.text}&rdquo;</p>
              <p className="text-gray-500 text-xs font-medium">
                {r.name} — {r.city}, CO
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MOBILE STICKY CTA ─── */}
      {/* Fixed at bottom on phones — always visible, drives phone calls and form fills */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 border-t border-gray-800/80 backdrop-blur-sm">
        <div className="flex gap-2 px-4 py-3">
          <a
            href={`tel:${phone}`}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call Now
          </a>
          <a
            href="#estimator"
            className="flex-1 flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-amber-900/30"
          >
            Free Inspection
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 mt-8">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-amber-500 font-black text-lg mb-3">FARADAY Construction</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Colorado&apos;s trusted experts for roofing, hail damage, windows, and solar.
                Serving the Front Range since 2012.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Services</h4>
              <ul className="space-y-1.5 text-sm text-gray-400">
                <li>Hail Damage Repair</li>
                <li>Roof Replacement</li>
                <li>Windows &amp; Doors</li>
                <li>Solar Installation</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3">Contact</h4>
              <div className="space-y-2 text-sm text-gray-400">
                <p>
                  <a href={`tel:${phone}`} className="hover:text-amber-400 transition-colors">
                    {phone}
                  </a>
                </p>
                <p>
                  <a href={`mailto:${email}`} className="hover:text-amber-400 transition-colors">
                    {email}
                  </a>
                </p>
                <p>Colorado&apos;s Front Range</p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
            <span>© {new Date().getFullYear()} Faraday Construction. Licensed &amp; Insured in Colorado.</span>
            <div className="flex items-center gap-4">
              <a href="/blog" className="hover:text-gray-400 transition-colors">Blog</a>
              <a href="/storm" className="hover:text-gray-400 transition-colors">Storm Tracker</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
