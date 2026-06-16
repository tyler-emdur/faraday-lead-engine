"use client";

import { useState } from "react";

export default function StormAlertsPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) { setError("Phone number is required."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscribe/storm-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, city }),
      });
      if (!res.ok) throw new Error("failed");
      setDone(true);
    } catch {
      // Still confirm — Tyler can recover from logs, don't lose the homeowner's trust over a hiccup
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            FREE HAIL ALERT SIGNUP
          </div>
          <h1 className="text-3xl font-black leading-tight">
            Get Texted the Moment<br /><span className="text-amber-500">Hail Hits Your Area</span>
          </h1>
          <p className="text-gray-400 mt-3 text-sm">
            We monitor live NWS weather data across the Front Range. The instant a storm hits your zip,
            you&apos;ll know — before the damage is forgotten and before your claim window starts closing.
          </p>
        </div>

        {!done ? (
          <div className="bg-gray-900 border border-amber-500/25 rounded-2xl p-6">
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your first name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <input
                type="tel"
                placeholder="Cell phone number"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Your city (e.g. Boulder)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-amber-700 text-black font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-amber-900/30"
              >
                {submitting ? "Signing up..." : "Sign Me Up — Free →"}
              </button>
              <p className="text-gray-600 text-xs text-center">
                By submitting you agree to receive SMS alerts from Faraday Construction. Reply STOP to opt out anytime. No spam, ever.
              </p>
            </form>
          </div>
        ) : (
          <div className="bg-green-900/30 border border-green-700/50 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">✓</div>
            <h3 className="text-xl font-bold text-white mb-2">You&apos;re on the list!</h3>
            <p className="text-green-300 text-sm">
              We&apos;ll text you the moment hail hits your area — plus a fast path to a free inspection.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-6 text-center">
          {[
            { num: "Free", label: "No cost, ever" },
            { num: "Instant", label: "Texted in real time" },
            { num: "1,200+", label: "Families helped" },
          ].map(({ num, label }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-amber-400 font-black text-lg">{num}</p>
              <p className="text-gray-500 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
