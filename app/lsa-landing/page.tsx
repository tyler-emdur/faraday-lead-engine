"use client";

export default function LSALandingPage() {
  const phone = "(720) 766-1518";

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-lg w-full text-center">

        <div className="flex justify-center gap-6 mb-8 text-sm text-gray-500">
          <span>⭐ 4.9/5 Google</span>
          <span>✅ BBB A+ Rated</span>
          <span>🏛 Licensed &amp; Insured CO</span>
        </div>

        <h1 className="text-4xl font-black text-gray-900 mb-3 leading-tight">
          Free Roof Inspection<br />
          <span className="text-amber-500">Insurance Usually Covers It All</span>
        </h1>

        <p className="text-gray-600 text-lg mb-8">
          Serving the Colorado Front Range since 2012. We handle your insurance claim
          from start to finish — most homeowners pay only their deductible.
        </p>

        <a
          href={`tel:${phone.replace(/[^\d]/g, "")}`}
          className="block w-full bg-amber-500 text-black font-black text-xl py-5 rounded-2xl mb-4 hover:bg-amber-400 transition-colors"
        >
          📞 Call Now: {phone}
        </a>

        <p className="text-gray-400 text-sm mb-8">Available 7am – 7pm · Same-day inspections available</p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-left">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">
            Or request a callback
          </h2>
          <form
            action="/api/leads"
            method="post"
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const data = Object.fromEntries(new FormData(f));
              await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, source: "lsa", service: "hail_damage", homeowner: true }),
              });
              f.innerHTML = `<p class="text-center text-green-700 font-bold py-4">✅ Got it! Anna will text you within 5 minutes.</p>`;
            }}
          >
            <input name="name" type="text" placeholder="Your name" required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500" />
            <input name="phone" type="tel" placeholder="Phone number" required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500" />
            <input name="city" type="text" placeholder="Your city"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:outline-none focus:border-amber-500" />
            <button type="submit"
              className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-gray-800 transition-colors">
              Request Free Inspection →
            </button>
          </form>
        </div>

        <div className="mt-8 space-y-3 text-left">
          {[
            { name: "Michael T., Westminster", stars: 5, quote: "Faraday handled everything with our insurance. We got $19,200 covered and only paid our deductible. Highly recommend." },
            { name: "Jennifer R., Aurora", stars: 5, quote: "Inspector was here the next morning, had the report by noon. Claim was approved same week. Incredible service." },
          ].map(({ name, stars, quote }) => (
            <div key={name} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-amber-400 text-sm mb-1">{"★".repeat(stars)}</div>
              <p className="text-gray-700 text-sm italic mb-1">&ldquo;{quote}&rdquo;</p>
              <p className="text-gray-400 text-xs">— {name}</p>
            </div>
          ))}
        </div>

        <p className="text-gray-400 text-xs mt-6">
          Faraday Construction · 4165 57th St, Boulder CO 80301 · Licensed & Insured
        </p>
      </div>
    </main>
  );
}
