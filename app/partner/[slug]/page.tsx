"use client";

import { useEffect, useState, use } from "react";

interface PartnerData {
  partner: { name: string | null; company: string | null; type: string; status: string };
  referralLink: string;
  stats: {
    clicks: number; leads: number; accepted: number; pending: number;
    conversionRate: number; earnings: number; feePerLead: number; tier: string;
  };
  recentLeads: { name: string; city: string | null; service: string | null; accepted: boolean; date: string }[];
}

const TIER_COLOR: Record<string, string> = {
  New: "text-gray-400", Bronze: "text-amber-600", Silver: "text-gray-300",
  Gold: "text-amber-400", Platinum: "text-cyan-300",
};

function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export default function PartnerPortal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [data, setData] = useState<PartnerData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/partner/${slug}/stats`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setData)
      .catch(() => setError("Partner not found."));
  }, [slug]);

  if (error) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">{error}</div>;
  if (!data) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Loading…</div>;

  const { partner, referralLink, stats, recentLeads } = data;
  const displayName = partner.company || partner.name || "Partner";

  function copyLink() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-500 text-sm">Faraday Partner Portal</p>
            <h1 className="text-2xl font-black">{displayName}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Tier</p>
            <p className={`text-lg font-black ${TIER_COLOR[stats.tier] || "text-gray-400"}`}>{stats.tier}</p>
          </div>
        </div>

        {/* Earnings hero */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-gray-900 border border-emerald-800/40 rounded-2xl p-6 mb-5 text-center">
          <p className="text-emerald-300/70 text-sm uppercase tracking-wide">Earned with Faraday</p>
          <p className="text-5xl font-black text-emerald-300 mt-1">${stats.earnings.toLocaleString()}</p>
          <p className="text-gray-500 text-sm mt-2">
            {stats.accepted} accepted referral{stats.accepted === 1 ? "" : "s"}
            {stats.feePerLead > 0 && ` · $${stats.feePerLead} each`}
          </p>
        </div>

        {/* Funnel */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            ["Clicks", stats.clicks, "text-gray-300"],
            ["Leads", stats.leads, "text-blue-400"],
            ["Accepted", stats.accepted, "text-green-400"],
            ["Pending", stats.pending, "text-amber-400"],
          ].map(([label, val, color]) => (
            <div key={label as string} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
              <p className={`text-2xl font-black ${color}`}>{val as number}</p>
              <p className="text-gray-500 text-xs mt-1">{label as string}</p>
            </div>
          ))}
        </div>

        {/* Referral link + QR */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-5">
          <h2 className="font-bold mb-1">Your referral link</h2>
          <p className="text-gray-500 text-sm mb-3">Share this with clients who may have storm damage. Every lead is credited to you automatically.</p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-amber-400 text-sm break-all">{referralLink}</code>
            <button onClick={copyLink} className="bg-amber-500 text-black font-bold px-4 py-2 rounded-lg text-sm flex-shrink-0">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl(referralLink)} alt="Your referral QR code" width={120} height={120} className="bg-white p-2 rounded-lg" />
            <p className="text-xs text-gray-500">Print or text this QR code. Clients scan it → free inspection request → you get credited.</p>
          </div>
        </div>

        {/* Lead history */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="font-bold mb-3">Your referrals</h2>
          {recentLeads.length === 0 ? (
            <p className="text-gray-600 text-sm">No referrals yet. Share your link above to get started.</p>
          ) : (
            <div className="space-y-2">
              {recentLeads.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-800/50 pb-2 last:border-0">
                  <div>
                    <span className="text-gray-200">{l.name}</span>
                    {l.city && <span className="text-gray-500"> · {l.city}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 text-xs">{new Date(l.date).toLocaleDateString()}</span>
                    {l.accepted
                      ? <span className="text-green-400 text-xs font-semibold">✓ Accepted</span>
                      : <span className="text-amber-400/70 text-xs">Pending</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs mt-6">Faraday Construction partner network</p>
      </div>
    </div>
  );
}
