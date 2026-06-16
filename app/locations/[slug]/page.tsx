import { notFound } from "next/navigation";
import ChatWidget from "@/components/ChatWidget";
import ExitIntentPopup from "@/components/ExitIntentPopup";
import QuickCaptureForm from "@/components/QuickCaptureForm";
import FloatingChat from "@/components/FloatingChat";
import StormBanner from "@/components/StormBanner";
import InsuranceEstimator from "@/components/InsuranceEstimator";
import ActivityTicker from "@/components/ActivityTicker";
import type { Metadata } from "next";

const CITIES = [
  "denver", "boulder", "fort-collins", "colorado-springs", "longmont",
  "loveland", "aurora", "broomfield", "westminster", "arvada",
  "lakewood", "thornton", "castle-rock", "parker", "golden",
  "brighton", "greeley", "centennial", "littleton"
];

const SERVICES: Record<string, { title: string; desc: string; formService: string }> = {
  "roofing": {
    title: "Roof Replacement & Repair",
    desc: "Colorado's trusted roofing experts. Free inspections and full insurance claim support.",
    formService: "roofing"
  },
  "hail-damage": {
    title: "Hail & Storm Damage Repair",
    desc: "Your roof damage may be fully covered by insurance. We handle the entire claim process.",
    formService: "hail_damage"
  },
  "windows": {
    title: "Window Replacement",
    desc: "Energy-efficient window replacement. Lower your heating bills and upgrade your home.",
    formService: "windows"
  },
  "solar": {
    title: "Solar Panel Installation",
    desc: "Lock in your energy rates. Expert solar installation with full permit and rebate handling.",
    formService: "solar"
  }
};

export function generateStaticParams() {
  const params: { slug: string }[] = [];
  for (const city of CITIES) {
    for (const service of Object.keys(SERVICES)) {
      params.push({ slug: `${city}-${service}` });
    }
  }
  return params;
}

function parseSlug(slug: string) {
  for (const service of Object.keys(SERVICES)) {
    if (slug.endsWith(`-${service}`)) {
      const citySlug = slug.replace(`-${service}`, "");
      if (CITIES.includes(citySlug)) {
        return {
          city: citySlug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          serviceKey: service,
          ...SERVICES[service]
        };
      }
    }
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = parseSlug(resolvedParams.slug);
  if (!data) return {};

  return {
    title: `${data.title} in ${data.city}, CO | Faraday Construction`,
    description: `Expert ${data.title.toLowerCase()} in ${data.city}, Colorado. Free inspections, A+ BBB rating, and insurance claim specialists. Call now!`,
  };
}

export default async function LocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const data = parseSlug(resolvedParams.slug);
  
  if (!data) {
    notFound();
  }

  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";
  const email = process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@faradayconstruction.com";

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "RoofingContractor",
    name: "Faraday Construction",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com"}/locations/${resolvedParams.slug}`,
    telephone: phone,
    areaServed: `${data.city}, CO`,
    description: `Expert ${data.title.toLowerCase()} in ${data.city}, Colorado. Free inspections. We handle all insurance claims.`,
  };

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
            <a href="/" className="hidden sm:block text-gray-400 hover:text-white text-sm transition-colors">
              Home
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

      <StormBanner />

      {/* ─── HERO ─── */}
      <section className="max-w-6xl mx-auto px-4 pt-10 pb-10 md:pt-16 md:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-900/40 border border-amber-800/50 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Serving {data.city} &amp; Surrounding Areas
            </div>

            <h1 className="text-4xl md:text-5xl font-black text-white mb-5 leading-[1.1]">
              Expert {data.title} in <br />
              <span className="text-amber-500">{data.city}, CO</span>
            </h1>

            <p className="text-gray-300 text-lg mb-7 leading-relaxed">
              {data.desc} Most {data.city} homeowners pay nothing out of pocket beyond their deductible for storm damage.
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {["Licensed & Insured in CO", "4.9★ Google (200+ reviews)", "BBB A+ Accredited", "Fast Local Service"].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 rounded-full px-3 py-1.5 text-xs text-gray-300"
                >
                  <span className="text-amber-500 text-xs">✓</span>
                  {t}
                </span>
              ))}
            </div>

            <div className="mb-6">
              <ActivityTicker />
            </div>
          </div>

          <div className="bg-gray-900 border border-amber-500/25 rounded-2xl p-6 md:p-7 shadow-2xl shadow-black/40">
            <div className="mb-5">
              <h2 className="text-white font-bold text-xl mb-1">Free {data.city} Inspection</h2>
              <p className="text-gray-400 text-sm">30 seconds. We call or text within the hour.</p>
            </div>
            {/* Pass the specific service to the form so leads are tagged correctly */}
            <QuickCaptureForm source={`seo_${data.city.toLowerCase()}_${data.serviceKey}`} />
          </div>
        </div>
      </section>

      {/* ─── ANNA CHAT ─── */}
      <section className="border-t border-gray-800/60 bg-gray-900/20" id="chat">
        <div className="max-w-6xl mx-auto px-4 py-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Questions about {data.title.toLowerCase()} in {data.city}?
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Chat with Anna, our 24/7 assistant, for instant answers on pricing, insurance, and scheduling.
            </p>
          </div>
          <ChatWidget source={`seo_chat_${data.city.toLowerCase()}`} />
        </div>
      </section>
      
      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-800/60 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
            <span>© {new Date().getFullYear()} Faraday Construction. Licensed &amp; Insured in Colorado.</span>
            <div className="flex items-center gap-4">
              <a href="/" className="hover:text-gray-500 transition-colors">Home</a>
              <a href="/locations" className="hover:text-gray-500 transition-colors">All Locations</a>
              <a href="/storm-alerts" className="hover:text-gray-500 transition-colors">Free Hail Alerts</a>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
