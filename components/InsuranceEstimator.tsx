"use client";

import { useState } from "react";
import { getUtm, utmToSource, utmToSourceDetail } from "@/lib/utm";

interface EstimatorState {
  step: number;
  hailExposure: string;
  roofAge: string;
  damageIndicators: string[];
  insuranceStatus: string;
  name: string;
  phone: string;
  submitted: boolean;
  submitting: boolean;
}

const DAMAGE_OPTIONS = [
  { id: "gutters", label: "Dents on gutters or downspouts" },
  { id: "shingles", label: "Missing or cracked shingles" },
  { id: "granules", label: "Granules washing into gutters" },
  { id: "interior", label: "Water stains on ceiling or walls" },
  { id: "none", label: "None of the above (that I can see)" },
];

function calcEstimate(state: EstimatorState): { low: number; high: number; likelihood: string; color: string } {
  if (state.hailExposure === "no") {
    return { low: 0, high: 0, likelihood: "Low", color: "text-gray-400" };
  }

  let base = 9000;
  let max = 16000;

  // Roof age — older roof = bigger claim
  if (state.roofAge === "20+") { base += 6000; max += 12000; }
  else if (state.roofAge === "10-20") { base += 3000; max += 7000; }
  else if (state.roofAge === "5-10") { base += 1000; max += 3000; }

  // Damage indicators
  const dmg = state.damageIndicators;
  const hasInterior = dmg.includes("interior");
  const count = dmg.filter((d) => d !== "none").length;

  if (hasInterior) { base += 4000; max += 8000; }
  if (count >= 3) { base += 2000; max += 5000; }
  else if (count === 2) { base += 1000; max += 2500; }

  // Unsure about hail increases range (could be less)
  if (state.hailExposure === "unsure") { base = Math.round(base * 0.7); max = Math.round(max * 0.8); }

  const totalScore = base + max;
  const likelihood = totalScore > 30000 ? "Very High" : totalScore > 22000 ? "High" : totalScore > 14000 ? "Moderate" : "Possible";
  const color = likelihood === "Very High" || likelihood === "High" ? "text-red-400" : likelihood === "Moderate" ? "text-amber-400" : "text-blue-400";

  return { low: base, high: max, likelihood, color };
}

export default function InsuranceEstimator() {
  const [state, setState] = useState<EstimatorState>({
    step: 0,
    hailExposure: "",
    roofAge: "",
    damageIndicators: [],
    insuranceStatus: "",
    name: "",
    phone: "",
    submitted: false,
    submitting: false,
  });

  const estimate = calcEstimate(state);

  const setField = (field: keyof EstimatorState, value: unknown) =>
    setState((prev) => ({ ...prev, [field]: value }));

  const toggleDamage = (id: string) => {
    setState((prev) => {
      if (id === "none") {
        return { ...prev, damageIndicators: prev.damageIndicators.includes("none") ? [] : ["none"] };
      }
      const without = prev.damageIndicators.filter((d) => d !== "none");
      return {
        ...prev,
        damageIndicators: without.includes(id)
          ? without.filter((d) => d !== id)
          : [...without, id],
      };
    });
  };

  const next = () => setState((prev) => ({ ...prev, step: prev.step + 1 }));

  const handleSubmit = async () => {
    if (!state.phone) return;
    setState((prev) => ({ ...prev, submitting: true }));

    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: state.name || undefined,
          phone: state.phone || undefined,
          service: "hail_damage",
          insurance_filed: state.insuranceStatus === "filed" ? "true" : state.insuranceStatus === "planning" ? "planning_to" : "false",
          urgency: state.damageIndicators.includes("interior") ? "emergency" : "immediate",
          damage_visible: state.damageIndicators.filter((d) => d !== "none").length > 0,
          notes: `Estimator: hail=${state.hailExposure}, roof=${state.roofAge}, damage=${state.damageIndicators.join(",")}, insurance=${state.insuranceStatus}`,
          source: utmToSource(getUtm()) || "estimator",
          source_detail: utmToSourceDetail(getUtm()),
        }),
      });
      setField("submitted", true);
    } catch {
      // Still show success to not block the user
      setField("submitted", true);
    } finally {
      setState((prev) => ({ ...prev, submitting: false }));
    }
  };

  const progressPct = state.step === 0 ? 0 : state.step === 1 ? 25 : state.step === 2 ? 50 : state.step === 3 ? 75 : 100;

  return (
    <div className="bg-gray-900 border border-amber-500/20 rounded-2xl p-6 md:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1 text-amber-400 text-xs font-semibold mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Free Insurance Estimate
        </div>
        <h3 className="text-xl md:text-2xl font-black text-white mb-1">
          Is Your Roof Covered?
        </h3>
        <p className="text-gray-400 text-sm">4 quick questions — find out in 30 seconds</p>
      </div>

      {/* Progress bar */}
      {state.step > 0 && state.step <= 4 && (
        <div className="mb-6">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-400 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-gray-500 text-xs mt-1.5 text-right">Step {state.step} of 4</p>
        </div>
      )}

      {/* Step 0: CTA to start */}
      {state.step === 0 && (
        <div className="text-center">
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            {[
              { num: "$12K", label: "Average CO claim" },
              { num: "90%", label: "Claims fully covered" },
              { num: "Free", label: "Inspection + claim" },
            ].map(({ num, label }) => (
              <div key={label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                <p className="text-amber-400 font-black text-xl">{num}</p>
                <p className="text-gray-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={next}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 px-6 rounded-xl text-base transition-colors"
          >
            Check If My Roof Qualifies →
          </button>
          <p className="text-gray-600 text-xs mt-3">No commitment. Takes 30 seconds.</p>
        </div>
      )}

      {/* Step 1: Hail exposure */}
      {state.step === 1 && (
        <div>
          <p className="text-white font-semibold mb-4 text-center">
            Has your area been hit by hail or severe storms in the last 2 years?
          </p>
          <div className="space-y-2">
            {[
              { value: "yes", label: "Yes — definitely", sub: "I know there was hail" },
              { value: "unsure", label: "Not sure", sub: "There may have been storms" },
              { value: "no", label: "No / Probably not", sub: "Area wasn't affected" },
            ].map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => { setField("hailExposure", value); next(); }}
                className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-amber-500/40 rounded-xl px-4 py-3.5 text-left transition-all group"
              >
                <div>
                  <p className="text-white font-medium text-sm">{label}</p>
                  <p className="text-gray-500 text-xs">{sub}</p>
                </div>
                <span className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Roof age */}
      {state.step === 2 && (
        <div>
          <p className="text-white font-semibold mb-4 text-center">
            Approximately how old is your roof?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "under5", label: "Under 5 years" },
              { value: "5-10", label: "5–10 years" },
              { value: "10-20", label: "10–20 years" },
              { value: "20+", label: "20+ years" },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setField("roofAge", value); next(); }}
                className="bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-amber-500/40 rounded-xl px-4 py-4 text-center transition-all group"
              >
                <p className="text-white font-semibold">{label}</p>
              </button>
            ))}
          </div>
          <button onClick={() => { setField("roofAge", "unknown"); next(); }} className="w-full mt-2 text-gray-500 hover:text-gray-400 text-xs py-2 transition-colors">
            Not sure / Unknown →
          </button>
        </div>
      )}

      {/* Step 3: Damage indicators */}
      {state.step === 3 && (
        <div>
          <p className="text-white font-semibold mb-1 text-center">
            Have you noticed any of these? <span className="text-gray-500 font-normal">(select all that apply)</span>
          </p>
          <p className="text-gray-500 text-xs text-center mb-4">You don&apos;t need to be on the roof — pick what you&apos;ve seen</p>
          <div className="space-y-2 mb-4">
            {DAMAGE_OPTIONS.map(({ id, label }) => {
              const selected = state.damageIndicators.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleDamage(id)}
                  className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition-all border ${
                    selected
                      ? "bg-amber-500/10 border-amber-500/40 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${selected ? "bg-amber-500 border-amber-500 text-black" : "border-gray-600"}`}>
                    {selected && "✓"}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          <button
            onClick={next}
            disabled={state.damageIndicators.length === 0}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-40"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 4: Insurance status */}
      {state.step === 4 && (
        <div>
          <p className="text-white font-semibold mb-4 text-center">
            Has an insurance claim been filed for this damage?
          </p>
          <div className="space-y-2">
            {[
              { value: "no", label: "No — I want to know if I qualify", sub: "Faraday handles the whole process" },
              { value: "planning", label: "Planning to file", sub: "Want help with the claims process" },
              { value: "filed", label: "Already filed or in progress", sub: "Looking for a contractor" },
            ].map(({ value, label, sub }) => (
              <button
                key={value}
                onClick={() => { setField("insuranceStatus", value); next(); }}
                className="w-full flex items-center justify-between bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-amber-500/40 rounded-xl px-4 py-3.5 text-left transition-all group"
              >
                <div>
                  <p className="text-white font-medium text-sm">{label}</p>
                  <p className="text-gray-500 text-xs">{sub}</p>
                </div>
                <span className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Results + lead capture */}
      {state.step === 5 && !state.submitted && (
        <div>
          {state.hailExposure !== "no" ? (
            <>
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">Based on your answers, your potential claim:</p>
                <p className={`text-4xl font-black mb-1 ${estimate.color}`}>
                  ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}
                </p>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-gray-800 ${estimate.color}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {estimate.likelihood} likelihood of insurance coverage
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Based on average Colorado hail claims for homes with similar profiles.
                  Actual coverage depends on your policy and a professional inspection.
                </p>
              </div>

              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-4 text-sm text-gray-300">
                <p className="font-semibold text-white mb-2">To confirm your coverage and start the process:</p>
                <ul className="space-y-1.5 text-xs text-gray-400">
                  <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0">✓</span>Free inspection — we come to you</li>
                  <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0">✓</span>We file the insurance claim for you</li>
                  <li className="flex gap-2"><span className="text-amber-500 flex-shrink-0">✓</span>You pay only your deductible</li>
                </ul>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Your first name"
                  value={state.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
                />
                <input
                  type="tel"
                  placeholder="Phone number (for your free inspection)"
                  value={state.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!state.phone || state.submitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {state.submitting ? "Scheduling..." : "Schedule My Free Inspection →"}
                </button>
                <p className="text-gray-600 text-xs text-center">
                  A specialist will call within the hour. No commitment.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 mb-4">
                Even without recent hail, older roofs often develop issues during Colorado&apos;s freeze-thaw cycles. A free inspection is always worthwhile.
              </p>
              <button
                onClick={next}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm"
              >
                Schedule Free Inspection Anyway →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 6 (fallback for "no hail" path) */}
      {state.step === 6 && !state.submitted && (
        <div className="space-y-3">
          <p className="text-white font-semibold text-center mb-2">Schedule your free inspection</p>
          <input
            type="text"
            placeholder="Your first name"
            value={state.name}
            onChange={(e) => setField("name", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={state.phone}
            onChange={(e) => setField("phone", e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
          />
          <button
            onClick={handleSubmit}
            disabled={!state.phone || state.submitting}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            {state.submitting ? "Scheduling..." : "Get My Free Inspection →"}
          </button>
        </div>
      )}

      {/* Success state */}
      {state.submitted && (
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="text-white font-bold text-lg mb-2">You&apos;re all set!</h4>
          <p className="text-gray-400 text-sm mb-4">
            A Faraday specialist will reach out within the hour to schedule your free inspection.
          </p>
          {state.phone && (
            <p className="text-gray-500 text-xs">
              Expect a call and text to {state.phone}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
