"use client";

import { useState, useEffect, useCallback } from "react";
import { estimatePipelineValue } from "@/lib/scoring";

const PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "faraday2024";

type Tab = "leads" | "storms" | "content" | "activity";

interface Lead {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  service?: string;
  city?: string;
  zip?: string;
  grade?: string;
  score?: number;
  urgency?: string;
  status?: string;
  source?: string;
  insurance_filed?: string;
  damage_visible?: boolean;
  created_at: string;
}

interface Storm {
  id: string;
  event: string;
  headline?: string;
  severity: string;
  areas?: string;
  affected_cities?: string[];
  has_hail: boolean;
  posted_to_facebook: boolean;
  detected_at: string;
}

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  target_keyword?: string;
  target_city?: string;
  published: boolean;
  published_at?: string;
  created_at: string;
}

interface Activity {
  id: string;
  type: string;
  description?: string;
  created_at: string;
}

function PipelineSummary({ leads }: { leads: Lead[] }) {
  const hot = leads.filter((l) => l.grade === "A");
  const warm = leads.filter((l) => l.grade === "B");
  const cool = leads.filter((l) => l.grade === "C" || l.grade === "D");
  const open = leads.filter((l) => l.status !== "won" && l.status !== "lost");

  const pipelineValue = open.reduce((sum, l) => {
    return sum + estimatePipelineValue(l.grade || "D", l.service);
  }, 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-2xl font-black text-white">{leads.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">Total Leads</p>
      </div>
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-4">
        <p className="text-2xl font-black text-red-400">{hot.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">🔥 Hot (A-grade)</p>
      </div>
      <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-4">
        <p className="text-2xl font-black text-amber-400">{warm.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">🟡 Warm (B-grade)</p>
      </div>
      <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-4">
        <p className="text-2xl font-black text-emerald-400">${(pipelineValue / 1000).toFixed(0)}K</p>
        <p className="text-xs text-gray-500 mt-0.5">Est. Pipeline ({open.length} open)</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);
  const [tab, setTab] = useState<Tab>("leads");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingLead, setUpdatingLead] = useState<string | null>(null);

  // Filters
  const [serviceFilter, setServiceFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const updateLeadStatus = async (id: string, status: string) => {
    setUpdatingLead(id);
    try {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    } finally {
      setUpdatingLead(null);
    }
  };

  const checkPassword = () => {
    if (pw === PASSWORD) {
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (serviceFilter) params.set("service", serviceFilter);
      if (gradeFilter) params.set("grade", gradeFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "200");
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
    } finally {
      setLoading(false);
    }
  }, [serviceFilter, gradeFilter, statusFilter]);

  const loadStorms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/storms");
      const data = await res.json();
      setStorms(data.storms || []);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activity");
      const data = await res.json();
      setActivity(data.activity || []);
    } catch {
      setActivity([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (tab === "leads") loadLeads();
    else if (tab === "storms") loadStorms();
    else if (tab === "content") loadContent();
    else if (tab === "activity") loadActivity();
  }, [authed, tab, loadLeads, loadStorms, loadContent, loadActivity]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-white mb-1">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">Faraday Construction</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && checkPassword()}
            placeholder="Password"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 mb-3"
          />
          {pwError && (
            <p className="text-red-400 text-xs mb-3">Incorrect password.</p>
          )}
          <button
            onClick={checkPassword}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const gradeColor = (g?: string) => {
    if (g === "A") return "text-red-400 bg-red-900/30";
    if (g === "B") return "text-amber-400 bg-amber-900/30";
    if (g === "C") return "text-blue-400 bg-blue-900/30";
    return "text-gray-400 bg-gray-800/60";
  };

  const serviceLabel: Record<string, string> = {
    roofing: "Roofing",
    hail_damage: "Hail",
    windows: "Windows",
    solar: "Solar",
    multiple: "Multiple",
  };

  const typeIcon: Record<string, string> = {
    lead_captured: "👤",
    storm_detected: "🌨️",
    blog_published: "📝",
    email_sent: "📧",
    sms_sent: "💬",
    review_requested: "⭐",
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-amber-500 font-black">FARADAY</span>
            <span className="text-gray-500 text-sm">Admin</span>
          </div>
          <div className="flex gap-1">
            {(["leads", "storms", "content", "activity"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  tab === t
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* LEADS */}
        {tab === "leads" && (
          <div>
            <PipelineSummary leads={leads} />

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Leads
                <span className="ml-2 text-sm text-gray-500 font-normal">{leads.length} total</span>
              </h2>
              <div className="flex gap-2 flex-wrap justify-end">
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="">All Services</option>
                  <option value="hail_damage">Hail Damage</option>
                  <option value="roofing">Roofing</option>
                  <option value="windows">Windows</option>
                  <option value="solar">Solar</option>
                  <option value="multiple">Multiple</option>
                </select>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="">All Grades</option>
                  <option value="A">A — HOT</option>
                  <option value="B">B — WARM</option>
                  <option value="C">C — COOL</option>
                  <option value="D">D — COLD</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none"
                >
                  <option value="">All Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="quoted">Quoted</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                <button
                  onClick={loadLeads}
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No leads yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-800">
                      {["Grade", "Name", "Phone", "Service", "Urgency", "Source", "Location", "Date", "Status"].map((h) => (
                        <th key={h} className="pb-3 pr-4 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-800/50 hover:bg-gray-900/40 transition-colors">
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${gradeColor(lead.grade)}`}>
                            {lead.grade || "?"} · {lead.score ?? 0}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-white font-medium">{lead.name || "—"}</td>
                        <td className="py-3 pr-4 text-gray-300">
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`} className="hover:text-amber-400 transition-colors">
                              {lead.phone}
                            </a>
                          ) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-gray-300">{serviceLabel[lead.service || ""] || lead.service || "—"}</td>
                        <td className="py-3 pr-4">
                          {lead.urgency === "emergency" ? (
                            <span className="text-red-400 font-semibold text-xs">EMERGENCY</span>
                          ) : (
                            <span className="text-gray-400 capitalize text-xs">{lead.urgency?.replace("_", " ") || "—"}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-gray-500 text-xs capitalize">{lead.source?.replace("_", " ") || "—"}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-400">{lead.city || lead.zip || "—"}</td>
                        <td className="py-3 pr-4 text-gray-500 text-xs">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <select
                            value={lead.status || "new"}
                            disabled={updatingLead === lead.id}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-xs text-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500/60 disabled:opacity-50"
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="quoted">Quoted</option>
                            <option value="won">Won</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STORMS */}
        {tab === "storms" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Storm Alerts</h2>
              <button
                onClick={loadStorms}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : storms.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No storm alerts on record.</div>
            ) : (
              <div className="space-y-3">
                {storms.map((s) => (
                  <div
                    key={s.id}
                    className={`bg-gray-900 border rounded-xl p-4 ${s.has_hail ? "border-red-800/60" : "border-gray-800"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {s.has_hail && (
                            <span className="text-xs bg-red-900/60 text-red-300 px-2 py-0.5 rounded-full font-medium">
                              HAIL
                            </span>
                          )}
                          <span className="text-xs bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-full">
                            {s.severity}
                          </span>
                          {s.posted_to_facebook && (
                            <span className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full">
                              Posted to FB
                            </span>
                          )}
                        </div>
                        <p className="text-white font-medium text-sm">{s.headline || s.event}</p>
                        {s.affected_cities && s.affected_cities.length > 0 && (
                          <p className="text-amber-400 text-xs mt-1">
                            Front Range: {s.affected_cities.join(", ")}
                          </p>
                        )}
                        {s.areas && (
                          <p className="text-gray-500 text-xs mt-1 line-clamp-2">{s.areas}</p>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(s.detected_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENT */}
        {tab === "content" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Blog Posts</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Auto-generated every Monday at 9am — targeting local SEO keywords
                </p>
              </div>
              <button
                onClick={loadContent}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : posts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No blog posts yet. First one generates next Monday.</div>
            ) : (
              <div className="space-y-3">
                {posts.map((p) => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <a
                          href={`/blog/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white font-medium hover:text-amber-400 transition-colors"
                        >
                          {p.title}
                        </a>
                        <p className="text-gray-500 text-xs mt-1">/{p.slug}</p>
                        {p.target_keyword && (
                          <p className="text-amber-400/70 text-xs mt-1">
                            Keyword: {p.target_keyword.replace("{city}", p.target_city || "?")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.published ? "bg-emerald-900/40 text-emerald-300" : "bg-gray-800 text-gray-400"}`}>
                          {p.published ? "Published" : "Draft"}
                        </span>
                        <p className="text-gray-500 text-xs mt-1">
                          {p.published_at
                            ? new Date(p.published_at).toLocaleDateString()
                            : new Date(p.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY */}
        {tab === "activity" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Activity Log</h2>
              <button
                onClick={loadActivity}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : activity.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No activity yet.</div>
            ) : (
              <div className="space-y-2">
                {activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 bg-gray-900/60 border border-gray-800/60 rounded-xl p-3"
                  >
                    <span className="text-lg">{typeIcon[a.type] || "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 text-sm">{a.description || a.type}</p>
                      <p className="text-gray-600 text-xs mt-0.5">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
