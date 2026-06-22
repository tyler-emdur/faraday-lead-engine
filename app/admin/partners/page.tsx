"use client";

import { useState, useEffect, useCallback } from "react";

const PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "faraday2024";

const TYPES = [
  "public_adjuster", "home_inspector", "property_manager", "realtor",
  "restoration_contractor", "solar_installer", "gutter_company", "insurance_agent",
  "hoa_manager", "plumber", "hvac_company", "general_contractor",
  "mortgage_broker", "title_company", "other",
];
const STATUSES = ["identified", "contacted", "interested", "active", "producing", "inactive"];

const STATUS_COLOR: Record<string, string> = {
  identified: "text-gray-400", contacted: "text-blue-400", interested: "text-amber-400",
  active: "text-green-400", producing: "text-emerald-300 font-bold", inactive: "text-gray-600",
  unregistered: "text-purple-400",
};

interface Partner {
  id: string; slug: string; name: string | null; company: string | null; type: string;
  status: string; contact_phone: string | null; contact_email: string | null;
  zip_codes: string[]; referral_fee: number; registered: boolean;
  clicks: number; leads: number; accepted: number; conversionRate: number;
  grossRevenue: number; netRevenue: number; trackingUrl: string;
}

function qrUrl(data: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export default function PartnersPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", company: "", type: "public_adjuster", zip_codes: "", referral_fee: "25", contact_phone: "", contact_email: "" });
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/partners").then(r => r.json())
      .then(d => setPartners(d.partners || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function createPartner() {
    setErr("");
    const res = await fetch("/api/admin/partners", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || "Failed"); return; }
    setForm({ name: "", company: "", type: "public_adjuster", zip_codes: "", referral_fee: "25", contact_phone: "", contact_email: "" });
    load();
  }

  async function patchPartner(id: string, updates: Record<string, unknown>) {
    await fetch("/api/admin/partners", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...updates }),
    });
    load();
  }

  async function runDiscovery() {
    if (!confirm("Import collected prospects as partner candidates (status: identified)?")) return;
    const res = await fetch("/api/admin/partners/discover", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    });
    const d = await res.json();
    alert(res.ok ? `Imported ${d.imported} candidates (${d.skipped} skipped).` : (d.error || "Failed"));
    load();
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-white mb-6">Partner Network</h1>
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

  const totals = partners.reduce((a, p) => ({
    leads: a.leads + p.leads, accepted: a.accepted + p.accepted, net: a.net + p.netRevenue,
  }), { leads: 0, accepted: 0, net: 0 });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Partner Network</h1>
            <p className="text-gray-500 text-sm">{partners.length} partners · {totals.accepted} accepted leads · ${totals.net.toLocaleString()} net earned</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runDiscovery} className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg">Discover candidates</button>
            <a href="/admin" className="text-gray-500 hover:text-white text-sm">← Admin</a>
          </div>
        </div>

        {/* Add partner */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-white mb-3">Add Partner <span className="text-gray-500 font-normal text-sm">— one setup, leads for years</span></h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contact name"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
            <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Company"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/60">
              {TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
            <input value={form.referral_fee} onChange={e => setForm({ ...form, referral_fee: e.target.value })} placeholder="Fee $/lead" type="number"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
            <input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="Phone (for storm alerts)"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
            <input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="Email"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
            <input value={form.zip_codes} onChange={e => setForm({ ...form, zip_codes: e.target.value })} placeholder="Service ZIPs (80202, 80203…)"
              className="col-span-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/60" />
          </div>
          {err && <p className="text-red-400 text-xs mt-2">{err}</p>}
          <button onClick={createPartner} className="mt-3 bg-amber-500 text-black font-bold px-5 py-2 rounded-lg text-sm hover:bg-amber-400">Create + Generate Link</button>
        </div>

        {/* Partner list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading…</div>
        ) : partners.length === 0 ? (
          <div className="text-center py-12 text-gray-600">No partners yet. Add one above.</div>
        ) : (
          <div className="space-y-3">
            {partners.map(p => (
              <div key={p.slug} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white capitalize">{p.name || p.slug.replace(/-/g, " ")}</span>
                      {p.company && <span className="text-gray-500 text-sm">{p.company}</span>}
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded capitalize">{p.type.replace(/_/g, " ")}</span>
                      {p.registered ? (
                        <select value={p.status} onChange={e => patchPartner(p.id, { status: e.target.value })}
                          className={`bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs capitalize focus:outline-none ${STATUS_COLOR[p.status] || "text-gray-400"}`}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs ${STATUS_COLOR.unregistered}`}>unregistered (legacy clicks)</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-amber-400 text-xs break-all">{p.trackingUrl}</code>
                      <button onClick={() => navigator.clipboard.writeText(p.trackingUrl)}
                        className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-0.5 rounded">Copy</button>
                      <button onClick={() => setShowQr(showQr === p.slug ? null : p.slug)}
                        className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-0.5 rounded">QR</button>
                      <a href={`/partner/${p.slug}`} target="_blank" rel="noreferrer"
                        className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-0.5 rounded">Portal ↗</a>
                    </div>
                    {p.zip_codes.length > 0 && (
                      <p className="text-xs text-gray-600 mt-1">ZIPs: {p.zip_codes.join(", ")}</p>
                    )}
                  </div>

                  <div className="flex gap-5 text-center text-sm">
                    <div><div className="text-gray-500 text-xs">Clicks</div><div className="text-gray-300 font-semibold">{p.clicks}</div></div>
                    <div><div className="text-gray-500 text-xs">Leads</div><div className="text-blue-400 font-semibold">{p.leads}</div></div>
                    <div><div className="text-gray-500 text-xs">Accepted</div><div className="text-green-400 font-bold">{p.accepted}</div></div>
                    <div><div className="text-gray-500 text-xs">Conv</div><div className="text-gray-400">{p.conversionRate}%</div></div>
                    <div><div className="text-gray-500 text-xs">Net $</div><div className="text-emerald-300 font-bold">${p.netRevenue.toLocaleString()}</div></div>
                  </div>
                </div>

                {showQr === p.slug && (
                  <div className="mt-3 pt-3 border-t border-gray-800 flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl(p.trackingUrl)} alt={`QR for ${p.slug}`} width={140} height={140} className="bg-white p-2 rounded-lg" />
                    <div className="text-xs text-gray-500">
                      <p>Print this for {p.name || p.slug}. Anyone who scans it lands on the hail-checker</p>
                      <p>and every lead is credited to this partner automatically.</p>
                      <a href={qrUrl(p.trackingUrl, 600)} target="_blank" rel="noreferrer" className="text-amber-400 underline mt-1 inline-block">Open print-size QR ↗</a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
