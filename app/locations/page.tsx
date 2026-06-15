import Link from "next/link";
import type { Metadata } from "next";

const CITIES = [
  "Denver", "Boulder", "Fort Collins", "Colorado Springs", "Longmont",
  "Loveland", "Aurora", "Broomfield", "Westminster", "Arvada",
  "Lakewood", "Thornton", "Castle Rock", "Parker", "Golden",
  "Brighton", "Greeley", "Centennial", "Littleton"
];

const SERVICES = [
  { id: "roofing", name: "Roof Replacement & Repair" },
  { id: "hail-damage", name: "Hail & Storm Damage" },
  { id: "windows", name: "Window Replacement" },
  { id: "solar", name: "Solar Panel Installation" }
];

export const metadata: Metadata = {
  title: "Service Areas | Faraday Construction",
  description: "View our roofing, solar, and window service areas across the Colorado Front Range.",
};

export default function LocationsIndexPage() {
  return (
    <main className="min-h-screen bg-gray-950 pb-16 sm:pb-0">
      <nav className="sticky top-0 z-40 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-black tracking-tight">FARADAY</span>
            <span className="text-gray-500 text-sm hidden sm:block">Construction</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-5">
            <Link href="/" className="text-gray-400 hover:text-white text-sm transition-colors">
              Home
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 py-16">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-6">
          Our <span className="text-amber-500">Service Areas</span>
        </h1>
        <p className="text-gray-400 text-lg mb-12 max-w-2xl">
          Faraday Construction provides expert roofing, hail damage repair, solar installation, and window replacement across the Colorado Front Range. Find your city below to learn more.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {SERVICES.map((service) => (
            <div key={service.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-800 pb-2">
                {service.name}
              </h2>
              <ul className="space-y-2">
                {CITIES.map((city) => {
                  const slug = `${city.toLowerCase().replace(/ /g, "-")}-${service.id}`;
                  return (
                    <li key={slug}>
                      <Link 
                        href={`/locations/${slug}`}
                        className="text-gray-400 hover:text-amber-400 text-sm transition-colors flex items-center gap-2"
                      >
                        <span className="text-amber-500/50">→</span>
                        {city}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-gray-800/60 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="border-t border-gray-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-700">
            <span>© {new Date().getFullYear()} Faraday Construction. Licensed &amp; Insured in Colorado.</span>
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:text-gray-500 transition-colors">Home</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
