"use client";

import { useState, useEffect } from "react";

const PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "faraday2024";

interface PartnerStat {
  slug: string;
  clicks: number;
  leads: number;
  conversionRate: number;
  estimatedValue: number;
  trackingUrl: string;
}

export default function PartnersPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [partners, setPartners] = useState<PartnerStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://leads.faradaysun.com";

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    fetch("/api/admin/partner-stats")
      .then(r => r.json())
      .then(d => setPartners(d.partners || []))
      .finally(() => setLoading(false));
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-white mb-6">Partner Dashboard</h1>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && pw === PW && setAuthed(true)}
            placeholder="Password" autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none mb-3" />
          <button onClick={() => pw === PW && setAuthed(true)}
            className="w-full bg-amber-500 text-black font-bold py-2.5 rounded-xl">Sign In</button>
        </div>
      </div>
    );
  }

  const generatedUrl = newSlug.trim()
    ? `${siteUrl}/api/track/${newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")}`
    : "";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">Partner Tracking</h1>
            <p className="text-gray-500 text-sm">Storm chaser referral links</p>
          </div>
          <a href="/admin" className="text-gray-500 hover:text-white text-sm">← Admin</a>
        </div>

        {/* Link generator */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-white mb-3">Generate Tracking Link</h2>
          <div className="flex gap-2">
            <input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="Partner name (e.g. mike-hernandez)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60 text-sm" />
          </div>
          {generatedUrl && (
            <div className="mt-3 bg-gray-800 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
              <code className="text-amber-400 text-xs break-all">{generatedUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(generatedUrl)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded-lg text-xs flex-shrink-0 transition-colors">
                Copy
              </button>
            </div>
          )}
          <p className="text-gray-600 text-xs mt-2">Give each storm chaser their own link. Clicks and leads are tracked automatically.</p>
        </div>

        {/* Stats table */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <p>No partner clicks yet.</p>
            <p className="text-sm mt-1">Generate a tracking link above and share it with your storm chasers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/50">
                  {["Partner","Clicks","Leads","Conversion","Est. Revenue","Tracking URL"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-semibold uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partners.map(p => (
                  <tr key={p.slug} className="border-b border-gray-800/40">
                    <td className="px-4 py-3 font-medium text-white capitalize">{p.slug.replace(/-/g, " ")}</td>
                    <td className="px-4 py-3 text-gray-300">{p.clicks}</td>
                    <td className="px-4 py-3">
                      <span className="text-green-400 font-bold">{p.leads}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{p.conversionRate}%</td>
                    <td className="px-4 py-3 text-green-400 font-semibold">${p.estimatedValue}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => navigator.clipboard.writeText(p.trackingUrl)}
                        className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-amber-400 px-2 py-1 rounded-lg transition-colors">
                        Copy Link
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
