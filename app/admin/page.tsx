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
  partner_id?: string;
  accepted?: boolean;
  accepted_at?: string;
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

type Tab = "leads" | "outreach" | "storms";

interface ContactFormItem {
  id: string;
  business_name: string;
  website: string;
  source?: string;
  city?: string;
  drafted_message: string;
  status: "pending_send" | "sent" | "skipped";
  queued_at: string;
  sent_at?: string;
}

interface OutreachProspect {
  id: string;
  company?: string;
  city?: string;
  source?: string;
  status?: string;
  email?: string;
  follow_up_count?: number;
  last_contacted_at?: string;
  created_at: string;
}

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
  partnerLabel,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  partnerLabel?: string | null;
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

  const toggleApprove = async () => {
    setSubmitting(true);
    try {
      const accepted = !lead.accepted;
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted }),
      });
      onUpdate(lead.id, { accepted, accepted_at: accepted ? new Date().toISOString() : undefined });
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
            ["Partner", partnerLabel || "—"],
            ["Approved", lead.accepted ? `✅ ${lead.accepted_at ? new Date(lead.accepted_at).toLocaleDateString() : "Yes"}` : "No"],
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
            onClick={toggleApprove}
            disabled={submitting}
            className={`flex-1 font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40 ${lead.accepted ? "bg-green-600/30 border border-green-600/60 text-green-300" : "bg-green-600 hover:bg-green-500 text-white"}`}
          >
            {lead.accepted ? "✓ Approved — tap to undo" : submitting ? "Approving..." : "Approve ($100)"}
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
  const approved = leads.filter(l => l.accepted);
  const convRate = leads.length ? Math.round((approved.length / leads.length) * 100) : 0;
  const avgScore = leads.length
    ? Math.round(leads.reduce((sum, l) => sum + (l.lead_score ?? l.score ?? 0), 0) / leads.length)
    : 0;
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
  const activeConvos = leads.filter(l => l.status === "contacted" && new Date(l.created_at) > twoDaysAgo);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {[
        { label: "Leads This Month", value: thisMonth.length, color: "text-white" },
        { label: "Approved (Revenue)", value: `${approved.length} × $100 = $${approved.length * 100}`, color: "text-green-400" },
        { label: "Approval Rate", value: `${convRate}%`, color: convRate >= 20 ? "text-green-400" : "text-amber-400" },
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
  const [contactForms, setContactForms] = useState<ContactFormItem[]>([]);
  const [outreachProspects, setOutreachProspects] = useState<OutreachProspect[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // partner_id → display name (slug/name), for the Partner column
  const [partnersById, setPartnersById] = useState<Record<string, string>>({});

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [partnerOnly, setPartnerOnly] = useState(false);
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
        const [leadsRes, partnersRes] = await Promise.all([
          fetch(`/api/leads?${params}`).then(r => r.json()),
          fetch("/api/admin/partners").then(r => r.json()).catch(() => ({ partners: [] })),
        ]);
        setLeads(leadsRes.leads || []);
        const map: Record<string, string> = {};
        for (const p of partnersRes.partners || []) {
          if (p.id) map[p.id] = p.name || p.company || p.slug;
        }
        setPartnersById(map);
      } else if (t === "outreach") {
        const r = await fetch("/api/admin/outreach");
        const d = await r.json();
        setContactForms(d.contactForms || []);
        setOutreachProspects(d.prospects || []);
      } else if (t === "storms") {
        const r = await fetch("/api/storms");
        const d = await r.json();
        setStorms(d.storms || []);
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

  // Approve = mark accepted (the $100 event that credits the referring partner in /admin/partners)
  const approveLead = async (id: string, accepted: boolean) => {
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    updateLead(id, { accepted, accepted_at: accepted ? new Date().toISOString() : undefined });
  };

  const partnerName = (l: Lead): string | null =>
    l.partner_id ? (partnersById[l.partner_id] || "Partner") : null;

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
    if (partnerOnly && !l.partner_id) return false;
    if (search) {
      const s = search.toLowerCase();
      return (l.name || "").toLowerCase().includes(s) || (l.phone || "").includes(s);
    }
    return true;
  });

  const TABS: Tab[] = ["leads", "outreach", "storms"];

  const updateFormStatus = async (id: string, status: "sent" | "skipped") => {
    await fetch("/api/admin/outreach", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setContactForms(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const copyMessage = (item: ContactFormItem) => {
    navigator.clipboard.writeText(item.drafted_message);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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
                {t}
              </button>
            ))}
            <a href="/admin/partners"
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              Partners
            </a>
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
              <button onClick={() => setPartnerOnly(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${partnerOnly ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white"}`}>
                {partnerOnly ? "✓ Partner leads" : "Partner leads"}
              </button>
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
                      {["Name","Phone","Partner","Source","Score","Status","Last Activity","Zip",""].map(h => (
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
                        <td className="px-4 py-3">
                          {partnerName(lead)
                            ? <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded">{partnerName(lead)}</span>
                            : <span className="text-gray-700 text-xs">—</span>}
                        </td>
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
                            {lead.accepted ? (
                              <button onClick={() => approveLead(lead.id, false)}
                                className="text-xs bg-green-600/30 border border-green-600/60 text-green-300 px-2 py-1 rounded-lg transition-colors"
                                title="Approved — click to undo">
                                ✓ Approved
                              </button>
                            ) : (
                              <button onClick={() => approveLead(lead.id, true)}
                                className="text-xs bg-green-900/40 hover:bg-green-900/60 border border-green-800 text-green-400 px-2 py-1 rounded-lg transition-colors">
                                Approve
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

        {/* ── OUTREACH ──────────────────────────────────────────────────────── */}
        {tab === "outreach" && (() => {
          const withEmail = outreachProspects.filter(p => p.email);
          const withoutEmail = outreachProspects.filter(p => !p.email);
          const contacted = withEmail.filter(p => p.status === "contacted" || (p.follow_up_count || 0) > 0);
          const pending = contactForms.filter(f => f.status === "pending_send");
          const sent = contactForms.filter(f => f.status === "sent");

          return (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Prospects w/ Email", value: withEmail.length, color: withEmail.length > 0 ? "text-green-400" : "text-red-400", note: "Cron can email these" },
                  { label: "Contacted", value: contacted.length, color: "text-amber-400", note: "Touched at least once" },
                  { label: "Form Queue — Pending", value: pending.length, color: pending.length > 0 ? "text-amber-400" : "text-gray-500", note: "Needs manual paste" },
                  { label: "Form Queue — Sent", value: sent.length, color: "text-green-400", note: "Done" },
                ].map(({ label, value, color, note }) => (
                  <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{note}</p>
                  </div>
                ))}
              </div>

              {withEmail.length === 0 && (
                <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-4 mb-6">
                  <p className="text-red-400 font-semibold text-sm">⚠ Cold-email engine is dormant — 0 prospects have an email address.</p>
                  <p className="text-red-300/70 text-xs mt-1">Run <code className="bg-red-950/50 px-1 rounded">node scripts/seed-real-prospects.js</code> to load ~85 prospects with emails and activate the cron.</p>
                </div>
              )}

              {/* Contact Form Queue */}
              {contactForms.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-white">Contact Form Queue</h2>
                    <span className="text-xs text-gray-500">{pending.length} pending · {sent.length} sent · {contactForms.filter(f => f.status === "skipped").length} skipped</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">These companies don&apos;t have direct emails — Anna drafted messages for their contact forms. Copy the message, paste it into their website form, then mark as sent.</p>
                  <div className="space-y-3">
                    {contactForms.map(item => (
                      <div key={item.id} className={`border rounded-xl p-4 ${item.status === "sent" ? "border-green-800/30 bg-green-950/10 opacity-60" : item.status === "skipped" ? "border-gray-800 opacity-40" : "border-gray-700 bg-gray-900"}`}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="font-medium text-white text-sm">{item.business_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">{item.city || "—"}</span>
                              {item.source && <span className="text-xs text-gray-600 capitalize">{item.source.replace(/_/g, " ")}</span>}
                              {item.website && (
                                <a href={item.website} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-amber-500 hover:text-amber-400 underline underline-offset-2">
                                  Open site →
                                </a>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                            item.status === "sent" ? "bg-green-900/40 text-green-400" :
                            item.status === "skipped" ? "bg-gray-800 text-gray-500" :
                            "bg-amber-900/30 text-amber-400"
                          }`}>{item.status === "pending_send" ? "pending" : item.status}</span>
                        </div>

                        <pre className="text-xs text-gray-300 bg-gray-800/60 rounded-lg p-3 whitespace-pre-wrap font-sans leading-relaxed mb-3">{item.drafted_message}</pre>

                        {item.status === "pending_send" && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyMessage(item)}
                              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 px-3 py-1.5 rounded-lg transition-colors font-medium"
                            >
                              {copiedId === item.id ? "✓ Copied!" : "Copy Message"}
                            </button>
                            <button
                              onClick={() => updateFormStatus(item.id, "sent")}
                              className="text-xs bg-green-900/30 hover:bg-green-900/50 border border-green-800 text-green-400 px-3 py-1.5 rounded-lg transition-colors font-medium"
                            >
                              Mark Sent
                            </button>
                            <button
                              onClick={() => updateFormStatus(item.id, "skipped")}
                              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Skip
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prospect table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold text-white">Email Prospects ({outreachProspects.length} total)</h2>
                  <div className="flex gap-2 text-xs text-gray-500">
                    <span className="text-green-400">{withEmail.length} w/ email</span>
                    <span>·</span>
                    <span className="text-gray-600">{withoutEmail.length} email=null</span>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-gray-900/50">
                        {["Company", "City", "Segment", "Email", "Status", "Touches", "Last Contact"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {outreachProspects.map(p => (
                        <tr key={p.id} className="border-b border-gray-800/40 hover:bg-gray-900/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-white text-xs">{p.company || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-400 text-xs">{p.city || "—"}</td>
                          <td className="px-4 py-2.5 text-xs">
                            <span className="text-gray-500 capitalize">{(p.source || "—").replace(/_/g, " ")}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {p.email
                              ? <span className="text-green-400 font-mono">{p.email}</span>
                              : <span className="text-gray-700 italic">null</span>
                            }
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            <span className={`px-2 py-0.5 rounded capitalize ${
                              p.status === "contacted" ? "bg-amber-900/30 text-amber-400" :
                              p.status === "replied" ? "bg-green-900/40 text-green-400" :
                              "bg-gray-800 text-gray-500"
                            }`}>{p.status || "new"}</span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{p.follow_up_count || 0} / 4</td>
                          <td className="px-4 py-2.5 text-xs text-gray-500">
                            {p.last_contacted_at ? new Date(p.last_contacted_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {outreachProspects.length === 0 && (
                    <p className="text-center py-12 text-gray-600">No prospects yet. Run seed-real-prospects.js to load them.</p>
                  )}
                </div>
              </div>
            </>
          );
        })()}

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
        <LeadDrawer lead={drawerLead} partnerLabel={partnerName(drawerLead)} onClose={() => setDrawerLead(null)} onUpdate={updateLead} />
      )}
    </div>
  );
}
