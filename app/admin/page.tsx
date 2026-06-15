"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const PW = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "faraday2024";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  zip?: string;
  service?: string;
  homeowner?: boolean;
  damage_visible?: boolean;
  has_insurance?: boolean;
  insurance_filed?: string;
  grade?: string;
  score?: number;
  lead_score?: number;
  urgency?: string;
  status?: string;
  source?: string;
  notes?: string;
  opted_out?: boolean;
  submitted_to_faraday?: boolean;
  submitted_at?: string;
  appointment_id?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  role: "user" | "assistant";
  content: string;
  channel: string;
  created_at: string;
}

interface Storm {
  id: string;
  event: string;
  headline?: string;
  severity?: string;
  areas?: string;
  affected_cities?: string[];
  has_hail: boolean;
  detected_at: string;
}

interface CronLog {
  id: string;
  cron_name: string;
  started_at: string;
  finished_at?: string;
  duration_ms?: number;
  result?: string;
  error?: string;
  leads_generated?: number;
}

interface Appointment {
  id: string;
  lead_id: string;
  requested_date?: string;
  requested_time_slot?: string;
  address?: string;
  confirmed: boolean;
  cancelled: boolean;
  created_at: string;
  lead?: Lead;
}

type Tab = "leads" | "submissions" | "crons" | "storms";

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score?: number }) {
  const s = score ?? 0;
  const color =
    s >= 71 ? "bg-green-900/40 text-green-400 border-green-800" :
    s >= 41 ? "bg-amber-900/40 text-amber-400 border-amber-800" :
    "bg-red-900/30 text-red-400 border-red-900";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${color}`}>
      {s}
    </span>
  );
}

// ─── Lead detail drawer ───────────────────────────────────────────────────────

function LeadDrawer({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<Lead>) => void;
}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState(lead.notes || "");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/leads/${lead.id}/conversations`)
      .then(r => r.json())
      .then(d => setConvos(d.conversations || []))
      .catch(() => {});
  }, [lead.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convos]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/leads/${lead.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });
      setConvos(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: reply,
        channel: "admin",
        created_at: new Date().toISOString(),
      }]);
      setReply("");
    } finally {
      setSending(false);
    }
  };

  const submitToFaraday = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitted_to_faraday: true, submitted_at: new Date().toISOString(), status: "submitted" }),
      });
      onUpdate(lead.id, { submitted_to_faraday: true, status: "submitted" });
    } finally {
      setSubmitting(false);
    }
  };

  const saveNotes = async () => {
    await fetch(`/api/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    onUpdate(lead.id, { notes });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-gray-900 border-l border-gray-800 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold">{lead.name || "Unknown"}</h2>
            <p className="text-gray-500 text-xs">{lead.source} · {new Date(lead.created_at).toLocaleDateString()}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl px-2">×</button>
        </div>

        {/* Lead info */}
        <div className="px-5 py-4 border-b border-gray-800 grid grid-cols-2 gap-2 text-sm">
          {[
            ["Phone", lead.phone ? <a href={`tel:${lead.phone}`} className="text-amber-400">{lead.phone}</a> : "—"],
            ["Email", lead.email || "—"],
            ["City/Zip", [lead.city, lead.zip].filter(Boolean).join(" ") || "—"],
            ["Address", lead.address || "—"],
            ["Score", <ScoreBadge key="score" score={lead.lead_score ?? lead.score} />],
            ["Homeowner", lead.homeowner ? "✅ Yes" : lead.homeowner === false ? "❌ No" : "?"],
            ["Has Insurance", lead.has_insurance ? "✅ Yes" : "?"],
            ["Damage Visible", lead.damage_visible ? "✅ Yes" : "?"],
            ["Status", lead.status || "new"],
            ["Submitted", lead.submitted_to_faraday ? `✅ ${lead.submitted_at ? new Date(lead.submitted_at).toLocaleDateString() : "Yes"}` : "No"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <span className="text-gray-500 text-xs block">{k}</span>
              <span className="text-white text-xs">{v}</span>
            </div>
          ))}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Conversation</p>
          {convos.length === 0 ? (
            <p className="text-gray-600 text-sm">No messages yet.</p>
          ) : convos.map(c => (
            <div key={c.id} className={`flex ${c.role === "assistant" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${c.role === "assistant" ? "bg-amber-500/20 text-amber-100" : "bg-gray-800 text-gray-200"}`}>
                <p>{c.content}</p>
                <p className="text-xs opacity-50 mt-1">{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        <div className="px-5 py-3 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply()}
              placeholder="Reply as Anna..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
            />
            <button onClick={sendReply} disabled={sending || !reply.trim()} className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors">
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-3 border-t border-gray-800">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Notes..."
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none resize-none"
          />
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-800 flex gap-2">
          <button
            onClick={submitToFaraday}
            disabled={submitting || !!lead.submitted_to_faraday}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-default text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {lead.submitted_to_faraday ? "✅ Submitted" : submitting ? "Submitting..." : "Submit to Faraday ($100)"}
          </button>
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              📞 Call
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Bar ──────────────────────────────────────────────────────────────────

function KPIBar({ leads }: { leads: Lead[] }) {
  const now = new Date();
  const thisMonth = leads.filter(l => {
    const d = new Date(l.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const submitted = leads.filter(l => l.submitted_to_faraday);
  const convRate = leads.length ? Math.round((submitted.length / leads.length) * 100) : 0;
  const avgScore = leads.length
    ? Math.round(leads.reduce((sum, l) => sum + (l.lead_score ?? l.score ?? 0), 0) / leads.length)
    : 0;
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const activeConvos = leads.filter(l => l.status === "contacted" && new Date(l.created_at) > twoDaysAgo);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {[
        { label: "Leads This Month", value: thisMonth.length, color: "text-white" },
        { label: "Submitted (Revenue)", value: `${submitted.length} × $100 = $${submitted.length * 100}`, color: "text-green-400" },
        { label: "Conversion Rate", value: `${convRate}%`, color: convRate >= 20 ? "text-green-400" : "text-amber-400" },
        { label: "Avg Lead Score", value: avgScore, color: avgScore >= 60 ? "text-green-400" : "text-amber-400" },
        { label: "Active Convos", value: activeConvos.length, color: "text-blue-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className={`text-xl font-black ${color}`}>{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("leads");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");

  // Drawer
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === "leads") {
        const params = new URLSearchParams({ limit: "300" });
        if (statusFilter) params.set("status", statusFilter);
        if (sourceFilter) params.set("source", sourceFilter);
        const r = await fetch(`/api/leads?${params}`);
        const d = await r.json();
        setLeads(d.leads || []);
      } else if (t === "storms") {
        const r = await fetch("/api/storms");
        const d = await r.json();
        setStorms(d.storms || []);
      } else if (t === "crons") {
        const r = await fetch("/api/admin/cron-logs");
        const d = await r.json();
        setCronLogs(d.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, sourceFilter]);

  useEffect(() => {
    if (authed) load(tab);
  }, [authed, tab, load]);

  const updateLead = (id: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    if (drawerLead?.id === id) setDrawerLead(prev => prev ? { ...prev, ...updates } : null);
  };

  const deleteLead = async (id: string) => {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads(prev => prev.filter(l => l.id !== id));
    if (drawerLead?.id === id) setDrawerLead(null);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-white mb-1">Anna Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">Faraday Construction</p>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (pw === PW ? (setAuthed(true), setPwError(false)) : setPwError(true))}
            placeholder="Password" autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 mb-3" />
          {pwError && <p className="text-red-400 text-xs mb-3">Incorrect password.</p>}
          <button onClick={() => pw === PW ? (setAuthed(true), setPwError(false)) : setPwError(true)}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl transition-colors">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const filteredLeads = leads.filter(l => {
    if (search) {
      const s = search.toLowerCase();
      return (l.name || "").toLowerCase().includes(s) || (l.phone || "").includes(s);
    }
    return true;
  });

  const submitted = leads.filter(l => l.submitted_to_faraday);
  const TABS: Tab[] = ["leads", "submissions", "crons", "storms"];

  // Cron schedule windows (expected run intervals in minutes)
  const CRON_WINDOWS: Record<string, number> = {
    "storm-check": 35, "reddit-monitor": 20, "follow-up": 70,
    "outbound-prospect": 60 * 8, "blog-generate": 60 * 24 * 7,
    "review-request": 60 * 25, "weekly-report": 60 * 24 * 7,
    "intel-digest": 60 * 25, "permit-monitor": 60 * 25,
    "fema-monitor": 60 * 13, "prospect-scraper": 60 * 24 * 7,
    "bid-monitor": 60 * 25, "competitor-reviews": 60 * 24 * 7,
    "listing-monitor": 60 * 25, "contact-form-targets": 60 * 24 * 7,
  };

  const latestByName: Record<string, CronLog> = {};
  for (const log of cronLogs) {
    if (!latestByName[log.cron_name] || new Date(log.started_at) > new Date(latestByName[log.cron_name].started_at)) {
      latestByName[log.cron_name] = log;
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-900/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-amber-500 font-black text-lg">FARADAY <span className="text-gray-500 text-sm font-normal">Admin</span></span>
          <div className="flex gap-1 flex-wrap">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                {t === "crons" ? "Cron Health" : t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">

        {/* ── LEADS ─────────────────────────────────────────────────────────── */}
        {tab === "leads" && (
          <>
            <KPIBar leads={leads} />

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..."
                className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none w-48" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none">
                <option value="">All Status</option>
                {["new","contacted","qualified","appointment_set","submitted","lost"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none">
                <option value="">All Sources</option>
                {["sms_inbound","email","widget","hail-map","lsa","angi","manychat","storm_alert"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => load("leads")}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors ml-auto">
                Refresh
              </button>
            </div>

            {loading ? <div className="text-center py-16 text-gray-500">Loading...</div> : (
              <div className="overflow-x-auto rounded-xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-900/50">
                      {["Name","Phone","Source","Score","Status","Last Activity","Zip",""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map(lead => (
                      <tr key={lead.id} className="border-b border-gray-800/40 hover:bg-gray-900/40 cursor-pointer transition-colors"
                        onClick={() => setDrawerLead(lead)}>
                        <td className="px-4 py-3 font-medium text-white">{lead.name || <span className="text-gray-600">Unknown</span>}</td>
                        <td className="px-4 py-3 text-gray-300">{lead.phone || "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs text-gray-500 capitalize">{lead.source?.replace(/_/g," ") || "—"}</span></td>
                        <td className="px-4 py-3"><ScoreBadge score={lead.lead_score ?? lead.score} /></td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                            lead.status === "submitted" ? "bg-green-900/40 text-green-400" :
                            lead.status === "new" ? "bg-blue-900/30 text-blue-400" :
                            lead.status === "lost" ? "bg-gray-800 text-gray-500" :
                            "bg-amber-900/30 text-amber-400"
                          }`}>{lead.status || "new"}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{lead.zip || lead.city || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            {lead.phone && (
                              <a href={`tel:${lead.phone}`}
                                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded-lg transition-colors">
                                📞
                              </a>
                            )}
                            {!lead.submitted_to_faraday && (
                              <button onClick={async () => {
                                await fetch(`/api/leads/${lead.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ submitted_to_faraday: true, submitted_at: new Date().toISOString(), status: "submitted" }),
                                });
                                updateLead(lead.id, { submitted_to_faraday: true, status: "submitted" });
                              }} className="text-xs bg-green-900/40 hover:bg-green-900/60 border border-green-800 text-green-400 px-2 py-1 rounded-lg transition-colors">
                                Submit
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm("Delete this lead?")) deleteLead(lead.id); }}
                              className="text-xs bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 text-red-500 px-2 py-1 rounded-lg transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLeads.length === 0 && <p className="text-center py-12 text-gray-600">No leads match your filters.</p>}
              </div>
            )}
          </>
        )}

        {/* ── SUBMISSIONS ───────────────────────────────────────────────────── */}
        {tab === "submissions" && (
          <>
            <div className="bg-gray-900 border border-green-800/40 rounded-xl p-5 mb-6">
              <p className="text-2xl font-black text-green-400">{submitted.length} leads submitted = ${submitted.length * 100} earned</p>
              <p className="text-gray-500 text-sm mt-1">All-time · $100 per warm lead submitted to Faraday</p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-900/50">
                    {["Date Submitted","Name","Phone","Zip","Source"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-semibold uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {submitted.sort((a,b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime()).map(l => (
                    <tr key={l.id} className="border-b border-gray-800/40">
                      <td className="px-4 py-3 text-gray-400 text-xs">{l.submitted_at ? new Date(l.submitted_at).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 font-medium">{l.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-300">{l.phone || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{l.zip || l.city || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs capitalize">{l.source?.replace(/_/g," ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {submitted.length === 0 && <p className="text-center py-12 text-gray-600">No submissions yet.</p>}
            </div>
          </>
        )}

        {/* ── CRON HEALTH ───────────────────────────────────────────────────── */}
        {tab === "crons" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Cron Health Monitor</h2>
              <button onClick={() => load("crons")} className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors">Refresh</button>
            </div>
            {loading ? <div className="text-center py-16 text-gray-500">Loading...</div> : (
              <div className="space-y-2">
                {Object.entries(CRON_WINDOWS).map(([name, windowMin]) => {
                  const log = latestByName[name];
                  const lastRun = log ? new Date(log.started_at) : null;
                  const minsAgo = lastRun ? Math.round((Date.now() - lastRun.getTime()) / 60000) : null;
                  const overdue = minsAgo !== null && minsAgo > windowMin;
                  const hasError = log?.result === "error";
                  const statusColor = !log ? "border-gray-700 bg-gray-900" :
                    hasError ? "border-red-800 bg-red-950/20" :
                    overdue ? "border-amber-800 bg-amber-950/20" :
                    "border-green-800/40 bg-green-950/10";
                  const dot = !log ? "bg-gray-600" : hasError ? "bg-red-500" : overdue ? "bg-amber-500" : "bg-green-500";

                  return (
                    <div key={name} className={`border rounded-xl px-4 py-3 flex items-center gap-4 ${statusColor}`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm text-white">{name}</p>
                        {log && <p className="text-xs text-gray-500">
                          {lastRun?.toLocaleString()} · {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : "—"}
                          {log.leads_generated ? ` · ${log.leads_generated} leads` : ""}
                        </p>}
                        {log?.error && <p className="text-xs text-red-400 truncate">{log.error}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">
                          {minsAgo !== null ? (minsAgo < 60 ? `${minsAgo}m ago` : `${Math.round(minsAgo/60)}h ago`) : "Never ran"}
                        </p>
                        <p className={`text-xs font-semibold ${!log ? "text-gray-500" : hasError ? "text-red-400" : overdue ? "text-amber-400" : "text-green-400"}`}>
                          {!log ? "NEVER RAN" : hasError ? "ERROR" : overdue ? "OVERDUE" : "OK"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(CRON_WINDOWS).length === 0 && cronLogs.length === 0 && (
                  <p className="text-center py-12 text-gray-600">No cron logs yet. Logs appear after the first run.</p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── STORMS ────────────────────────────────────────────────────────── */}
        {tab === "storms" && (
          <>
            <h2 className="text-lg font-bold mb-4">Storm Activity</h2>
            {loading ? <div className="text-center py-16 text-gray-500">Loading...</div> : (
              <div className="space-y-3">
                {storms.length === 0 && <p className="text-gray-600 text-center py-12">No storms detected yet.</p>}
                {storms.map(s => (
                  <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${s.has_hail ? "bg-red-900/40 text-red-400 border border-red-800" : "bg-gray-800 text-gray-400"}`}>
                        {s.has_hail ? "HAIL" : "WATCH"}
                      </span>
                      <span className="text-white font-medium">{s.event}</span>
                      <span className="text-gray-500 text-xs ml-auto">{new Date(s.detected_at).toLocaleString()}</span>
                    </div>
                    {s.affected_cities && s.affected_cities.length > 0 && (
                      <p className="text-gray-400 text-sm">{s.affected_cities.join(", ")}</p>
                    )}
                    {s.headline && <p className="text-gray-500 text-xs mt-1">{s.headline}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Lead Drawer */}
      {drawerLead && (
        <LeadDrawer lead={drawerLead} onClose={() => setDrawerLead(null)} onUpdate={updateLead} />
      )}
    </div>
  );
}
