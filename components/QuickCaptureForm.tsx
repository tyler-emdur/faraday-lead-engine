"use client";

import { useState } from "react";
import { getUtm, utmToSource, utmToSourceDetail } from "@/lib/utm";

const SERVICES = [
  { value: "hail_damage", label: "Hail Damage / Storm" },
  { value: "roofing", label: "Roof Repair or Replacement" },
  { value: "solar", label: "Solar Installation" },
  { value: "windows", label: "Windows & Doors" },
];

export default function QuickCaptureForm({ source = "quick_form" }: { source?: string }) {
  const [form, setForm] = useState({ name: "", phone: "", city: "", service: "hail_damage" });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source: utmToSource(getUtm()) || source,
          source_detail: utmToSourceDetail(getUtm()),
          urgency: "immediate",
        }),
      });
      if (res.ok) {
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="bg-green-900/30 border border-green-700/50 rounded-2xl p-8 text-center">
        <div className="text-5xl mb-3">✓</div>
        <h3 className="text-xl font-bold text-white mb-2">You&apos;re all set!</h3>
        <p className="text-green-300 text-sm">
          Our inspection team will call or text you within the hour.
          {form.phone && <> Watch for a message at <span className="font-semibold">{form.phone}</span>.</>}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <input
          type="text"
          placeholder="Your first name"
          required
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <input
          type="tel"
          placeholder="Cell phone number"
          required
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <input
          type="text"
          placeholder="Your city (e.g. Boulder)"
          required
          value={form.city}
          onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
        />
        <select
          value={form.service}
          onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
          className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
        >
          {SERVICES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:bg-amber-700 text-black font-bold py-4 rounded-xl text-base transition-colors shadow-lg shadow-amber-900/30"
      >
        {status === "loading" ? "Submitting..." : "Get My Free Inspection →"}
      </button>

      <p className="text-gray-500 text-xs text-center mt-2.5">
        Free, no obligation. Most hail claims: <span className="text-gray-400">$9,000–$22,000</span> fully covered by insurance.
      </p>

      {status === "error" && (
        <p className="text-red-400 text-xs text-center mt-2">
          Something went wrong — call us directly at <a href="tel:7207661518" className="underline">(720) 766-1518</a>
        </p>
      )}
    </form>
  );
}
