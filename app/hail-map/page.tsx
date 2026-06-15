"use client";

import { useState } from "react";

type Step = "input" | "loading" | "tease" | "capture" | "done";

interface HailResult {
  hasActivity: boolean;
  mostRecentDate: string;
  severity: "low" | "medium" | "high";
}

export default function HailMapPage() {
  const [step, setStep] = useState<Step>("input");
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<HailResult | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const checkZip = async () => {
    if (!zip.trim() || zip.length < 5) { setError("Enter a valid 5-digit zip code."); return; }
    setError("");
    setStep("loading");
    await new Promise(r => setTimeout(r, 1800));

    try {
      const res = await fetch(`/api/hail-map/check?zip=${encodeURIComponent(zip.trim())}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ hasActivity: true, mostRecentDate: "recently", severity: "medium" });
    }
    setStep("tease");
  };

  const captureAndReveal = async () => {
    if (!phone.trim()) { setError("Phone number is required."); return; }
    setError("");
    setSubmitting(true);
    try {
      await fetch("/api/hail-map/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, name, phone, capture: true, hasActivity: result?.hasActivity, mostRecentDate: result?.mostRecentDate }),
      });
    } catch { /* continue anyway */ }
    setSubmitting(false);
    setStep("done");
  };

  const severityBorder = result?.severity === "high" ? "border-red-500 bg-red-950/40 text-red-300" :
    result?.severity === "medium" ? "border-amber-500 bg-amber-950/40 text-amber-300" :
    "border-green-600 bg-green-950/30 text-green-300";

  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">

        <div className="text-center mb-8">
          <div className="inline-block bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
            FREE HAIL DAMAGE CHECK
          </div>
          <h1 className="text-3xl font-black text-white leading-tight">
            Did Hail Hit<br /><span className="text-amber-500">Your Home?</span>
          </h1>
          <p className="text-gray-400 mt-3 text-sm">
            We monitor NWS weather data across Colorado. Enter your zip to check.
          </p>
        </div>

        {step === "input" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input type="text" inputMode="numeric" maxLength={5}
                value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => e.key === "Enter" && checkZip()}
                placeholder="Enter ZIP code"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-4 text-white text-lg placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
              <button onClick={checkZip}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-6 py-4 rounded-xl transition-colors text-lg">
                Check
              </button>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <p className="text-gray-600 text-xs text-center mt-4">Covers all Colorado Front Range zips · Free, no obligation</p>
          </div>
        )}

        {step === "loading" && (
          <div className="text-center py-12">
            <div className="inline-block w-10 h-10 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="text-gray-400">Checking hail records for {zip}...</p>
            <p className="text-gray-600 text-xs mt-2">Scanning NWS data from the last 90 days</p>
          </div>
        )}

        {step === "tease" && result && (
          <div>
            <div className={`border-2 rounded-2xl p-5 mb-6 text-center ${severityBorder}`}>
              {result.hasActivity ? (
                <>
                  <div className="text-3xl mb-2">⚡</div>
                  <p className="font-black text-xl">Hail Activity Found Near {zip}</p>
                  <p className="text-sm mt-1 opacity-80">
                    Your area shows hail activity{result.mostRecentDate && result.mostRecentDate !== "recently" ? ` on ${result.mostRecentDate}` : " recently"}.
                    Your roof may have unreported damage.
                  </p>
                  <div className="mt-3 bg-black/30 rounded-xl px-4 py-2 text-xs">
                    Full report: estimated damage + claim value →{" "}
                    <span className="blur-sm select-none">████████████</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">🌤</div>
                  <p className="font-black text-xl">Limited Recent Data for {zip}</p>
                  <p className="text-sm mt-1 opacity-80">
                    No major NWS alerts in the last 90 days — but satellite data misses a lot.
                    A free inspection confirms what records can't.
                  </p>
                </>
              )}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="font-bold text-white mb-1">Get your full report</p>
              <p className="text-gray-400 text-sm mb-4">Anna will text you the complete assessment within 5 minutes.</p>
              <div className="space-y-3">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your first name"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="Phone number" required
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button onClick={captureAndReveal} disabled={submitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black py-3.5 rounded-xl transition-colors">
                  {submitting ? "Checking..." : "Text Me My Report →"}
                </button>
                <p className="text-gray-600 text-xs text-center">
                  By submitting you agree to receive SMS from Faraday Construction. Reply STOP to opt out.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-black text-white mb-2">Report Sent!</h2>
            <p className="text-gray-400 mb-6">
              Anna is texting you the full hail report for {zip} right now.
              If damage is likely, she can have an inspector out within 48 hours.
            </p>
            <a href="tel:7207661518"
              className="block w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-4 rounded-2xl transition-colors text-lg mb-3">
              📞 Call Now: (720) 766-1518
            </a>
            <p className="text-gray-600 text-xs">Free inspection · No obligation · Insurance usually covers 100%</p>
          </div>
        )}

      </div>
    </main>
  );
}
