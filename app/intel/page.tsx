"use client";

import { useState, useEffect, useCallback } from "react";
import type { Opportunity, OpportunityStatus, OpportunitySource } from "@/lib/intel";

const PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "faraday2024";

// ─── STATUS CONFIG ─────────────────────────────────────────────────────────────

const STATUS_FLOW: OpportunityStatus[] = [
  "new", "contacted", "replied", "inspection_booked", "won", "lost",
];

const STATUS_LABEL: Record<OpportunityStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  inspection_booked: "Booked",
  won: "Won",
  lost: "Lost",
};

const STATUS_COLOR: Record<OpportunityStatus, string> = {
  new: "bg-gray-700 text-gray-300",
  contacted: "bg-blue-900/60 text-blue-300",
  replied: "bg-purple-900/60 text-purple-300",
  inspection_booked: "bg-amber-900/60 text-amber-300",
  won: "bg-green-900/60 text-green-300",
  lost: "bg-red-900/80 text-red-400",
};

const SOURCE_LABEL: Record<string, string> = {
  reddit: "Reddit",
  storm: "Storm",
  community_import: "Community",
  property_scan: "Property",
};

const SOURCE_COLOR: Record<string, string> = {
  reddit: "bg-orange-900/50 text-orange-300",
  storm: "bg-sky-900/50 text-sky-300",
  community_import: "bg-violet-900/50 text-violet-300",
  property_scan: "bg-teal-900/50 text-teal-300",
};

// ─── IMPORT MODAL ──────────────────────────────────────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [source, setSource] = useState<"facebook" | "nextdoor" | "other">("facebook");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [author, setAuthor] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ matched: boolean; priority?: string; score?: number; keywords?: string[] } | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/intel/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, text, url: url || undefined, author: author || undefined, location: location || undefined }),
      });
      const data = await res.json();
      setResult(data);
      if (data.matched) onImported();
    } catch {
      setResult({ matched: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-bold text-lg">Import Community Post</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {result ? (
          <div className={`rounded-xl p-4 text-center ${result.matched ? "bg-green-900/40 border border-green-700" : "bg-gray-800"}`}>
            {result.matched ? (
              <>
                <p className="text-green-400 font-bold text-lg mb-1">Saved as {result.priority?.toUpperCase()} priority</p>
                <p className="text-green-300 text-sm">Score: {result.score}/100</p>
                {result.keywords?.length ? (
                  <p className="text-gray-400 text-xs mt-2">Keywords: {result.keywords.join(", ")}</p>
                ) : null}
                <button onClick={onClose} className="mt-4 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">Done</button>
              </>
            ) : (
              <>
                <p className="text-gray-400 font-semibold mb-2">No relevant keywords found</p>
                <p className="text-gray-500 text-sm">This post doesn't match roofing/hail/solar signals.</p>
                <button onClick={() => setResult(null)} className="mt-3 text-gray-400 text-sm underline">Try again</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {(["facebook", "nextdoor", "other"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${source === s ? "bg-white text-gray-900" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
                >
                  {s}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Paste the post text here..."
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-gray-500 outline-none resize-none mb-3"
            />

            <div className="grid grid-cols-2 gap-3 mb-4">
              <input
                placeholder="Author (optional)"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-gray-500 outline-none"
              />
              <input
                placeholder="City / neighborhood"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-gray-500 outline-none"
              />
              <input
                placeholder="URL (optional)"
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="col-span-2 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-gray-500 outline-none"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading || !text.trim()}
              className="w-full bg-white text-gray-900 font-bold py-2.5 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-100 transition-colors"
            >
              {loading ? "Analyzing..." : "Import & Score"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── OPPORTUNITY CARD ──────────────────────────────────────────────────────────

function OpportunityCard({
  opp,
  onStatusChange,
  adminPassword,
}: {
  opp: Opportunity;
  onStatusChange: (id: string, status: OpportunityStatus) => void;
  adminPassword: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [outreaching, setOutreaching] = useState(false);
  const [outreachDone, setOutreachDone] = useState(false);

  async function advance() {
    const currentIdx = STATUS_FLOW.indexOf(opp.status);
    if (currentIdx < 0 || currentIdx >= STATUS_FLOW.length - 2) return;
    const next = STATUS_FLOW[currentIdx + 1];
    setUpdating(true);
    try {
      await fetch(`/api/intel/track/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onStatusChange(opp.id, next);
    } finally {
      setUpdating(false);
    }
  }

  async function markLost() {
    setUpdating(true);
    try {
      await fetch(`/api/intel/track/${opp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "lost" }),
      });
      onStatusChange(opp.id, "lost");
    } finally {
      setUpdating(false);
    }
  }

  async function triggerOutreach() {
    setOutreaching(true);
    try {
      const res = await fetch(`/api/intel/outreach/${opp.id}`, {
        method: "POST",
        headers: { "x-admin-password": adminPassword },
      });
      if (res.ok) {
        setOutreachDone(true);
        onStatusChange(opp.id, "contacted");
      }
    } finally {
      setOutreaching(false);
    }
  }

  const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(opp.status) + 1];
  const canAdvance = opp.status !== "won" && opp.status !== "lost" && !!nextStatus;
  const estimatedValue = opp.close_probability != null
    ? Math.round((opp.close_probability / 100) * 100)
    : null;

  return (
    <div className={`bg-gray-900 border rounded-xl p-4 transition-opacity ${opp.status === "lost" ? "opacity-40" : ""}`}
         style={{ borderColor: opp.priority === "high" ? "#dc262640" : opp.priority === "medium" ? "#d9780640" : "#374151" }}>

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SOURCE_COLOR[opp.source]}`}>
              {SOURCE_LABEL[opp.source]}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[opp.status]}`}>
              {STATUS_LABEL[opp.status]}
            </span>
            <span className="text-xs text-gray-500">
              Score {opp.opportunity_score}/100
            </span>
            {estimatedValue != null && (
              <span className="text-xs text-green-400 font-bold">~${estimatedValue}</span>
            )}
            {opp.location && (
              <span className="text-xs text-gray-500">{opp.location}</span>
            )}
          </div>
          <p className="text-white font-semibold text-sm leading-snug">{opp.title}</p>
        </div>
      </div>

      {opp.why_it_matters && (
        <p className="text-gray-400 text-xs mb-3 leading-relaxed">{opp.why_it_matters}</p>
      )}

      {opp.outreach_message && (
        <div className="bg-green-950/40 border border-green-900/50 rounded-lg px-3 py-2 mb-3">
          <p className="text-green-400 text-xs font-semibold mb-0.5">Outreach</p>
          <p className="text-green-300 text-xs leading-relaxed">{opp.outreach_message}</p>
        </div>
      )}

      {expanded && (
        <div className="space-y-2 mb-3">
          {opp.body && (
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-gray-400 text-xs leading-relaxed">{opp.body.slice(0, 400)}</p>
            </div>
          )}
          {opp.follow_up_schedule && (
            <p className="text-gray-500 text-xs">Follow-up: {opp.follow_up_schedule}</p>
          )}
          {opp.close_probability != null && (
            <p className="text-gray-500 text-xs">Estimated close probability: {opp.close_probability}%</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {opp.url && (
          <a href={opp.url} target="_blank" rel="noopener noreferrer"
             className="text-xs text-blue-400 hover:text-blue-300 underline">
            View source
          </a>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {expanded ? "Less" : "More"}
        </button>

        <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
          {opp.status !== "won" && opp.status !== "lost" && (
            <button
              onClick={markLost}
              disabled={updating}
              className="text-xs text-gray-600 hover:text-red-400 px-2 py-1 rounded transition-colors"
            >
              Lost
            </button>
          )}
          {opp.status === "new" && !outreachDone && (
            <button
              onClick={triggerOutreach}
              disabled={outreaching}
              className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              {outreaching ? "Sending..." : "Anna Outreach"}
            </button>
          )}
          {outreachDone && (
            <span className="text-xs text-amber-400 font-semibold px-2 py-1">Outreach sent ✓</span>
          )}
          {canAdvance && nextStatus && (
            <button
              onClick={advance}
              disabled={updating}
              className="text-xs bg-white text-gray-900 font-semibold px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {updating ? "..." : `Mark ${STATUS_LABEL[nextStatus]}`}
            </button>
          )}
          {opp.status === "won" && (
            <span className="text-xs text-green-400 font-bold px-2 py-1">+$100</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── STATS BAR ──────────────────────────────────────────────────────────────────

function StatsBar({ opps }: { opps: Opportunity[] }) {
  const high = opps.filter(o => o.priority === "high").length;
  const medium = opps.filter(o => o.priority === "medium").length;
  const contacted = opps.filter(o => o.status !== "new").length;
  const booked = opps.filter(o => o.status === "inspection_booked" || o.status === "won").length;
  const won = opps.filter(o => o.status === "won").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {[
        { label: "High Priority", value: high, color: "text-red-400" },
        { label: "Medium Priority", value: medium, color: "text-amber-400" },
        { label: "Contacted", value: contacted, color: "text-blue-400" },
        { label: "Inspections Booked", value: booked, color: "text-green-400" },
        { label: "Revenue Earned", value: `$${won * 100}`, color: "text-white" },
      ].map(s => (
        <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────────

export default function IntelPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "active">("new");
  const [sortBy, setSortBy] = useState<"score" | "value" | "created">("score");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intel/opportunities?limit=200");
      const data = await res.json();
      setOpps(data.opportunities || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function updateStatus(id: string, status: OpportunityStatus) {
    setOpps(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-white font-black text-xl mb-1">Lead Intelligence</h1>
          <p className="text-gray-500 text-sm mb-6">Enter password to continue</p>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && pw === PASSWORD && setAuthed(true)}
            placeholder="Password"
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 outline-none mb-3 text-sm"
            autoFocus
          />
          <button
            onClick={() => pw === PASSWORD && setAuthed(true)}
            className="w-full bg-white text-gray-900 font-bold py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  const filtered = opps
    .filter(o => {
      if (filter === "new") return o.status === "new";
      if (filter === "active") return !["new", "won", "lost"].includes(o.status);
      return true;
    })
    .filter(o => sourceFilter === "all" || o.source === sourceFilter)
    .sort((a, b) => {
      if (sortBy === "value") return ((b.close_probability ?? 0) - (a.close_probability ?? 0));
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0);
    });

  const high = filtered.filter(o => o.priority === "high");
  const medium = filtered.filter(o => o.priority === "medium");
  const low = filtered.filter(o => o.priority === "low");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load(); }}
        />
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black">Lead Intelligence</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImport(true)}
              className="bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              + Import Post
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        <StatsBar opps={opps} />

        {/* Filter + sort controls */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 border border-gray-800">
            {(["new", "active", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${filter === f ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}
              >
                {f === "new" ? "New" : f === "active" ? "In Progress" : "All"}
              </button>
            ))}
          </div>
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-xl px-3 py-1.5 outline-none"
          >
            <option value="all">All sources</option>
            <option value="storm">Storm</option>
            <option value="reddit">Reddit</option>
            <option value="community_import">Community</option>
            <option value="property_scan">Property</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-xl px-3 py-1.5 outline-none"
          >
            <option value="score">Sort: Score</option>
            <option value="value">Sort: Est. Value</option>
            <option value="created">Sort: Newest</option>
          </select>
        </div>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg font-semibold mb-1">No opportunities yet</p>
            <p className="text-sm">They appear automatically when storms hit or Reddit posts match. Import a community post manually above.</p>
          </div>
        )}

        {/* HIGH PRIORITY */}
        {high.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider">High Priority — Act Today</h2>
              <span className="text-xs text-gray-600">{high.length}</span>
            </div>
            <div className="space-y-3">
              {high.map(o => <OpportunityCard key={o.id} opp={o} onStatusChange={updateStatus} adminPassword={pw} />)}
            </div>
          </section>
        )}

        {/* MEDIUM PRIORITY */}
        {medium.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <h2 className="text-sm font-bold text-amber-400 uppercase tracking-wider">Medium Priority</h2>
              <span className="text-xs text-gray-600">{medium.length}</span>
            </div>
            <div className="space-y-3">
              {medium.map(o => <OpportunityCard key={o.id} opp={o} onStatusChange={updateStatus} adminPassword={pw} />)}
            </div>
          </section>
        )}

        {/* LOW PRIORITY */}
        {low.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Low Priority</h2>
              <span className="text-xs text-gray-600">{low.length}</span>
            </div>
            <div className="space-y-3">
              {low.map(o => <OpportunityCard key={o.id} opp={o} onStatusChange={updateStatus} adminPassword={pw} />)}
            </div>
          </section>
        )}

        {/* Conversion tracking summary */}
        {opps.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Source Attribution</h2>

            {/* Source performance table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Source</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Found</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Contacted</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Booked</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Won</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs">Contact%</th>
                  </tr>
                </thead>
                <tbody>
                  {(["reddit", "storm", "community_import", "property_scan"] as OpportunitySource[]).map(src => {
                    const srcOpps = opps.filter(o => o.source === src);
                    if (!srcOpps.length) return null;
                    const contacted = srcOpps.filter(o => o.status !== "new").length;
                    const booked = srcOpps.filter(o => o.status === "inspection_booked" || o.status === "won").length;
                    const won = srcOpps.filter(o => o.status === "won").length;
                    const contactPct = srcOpps.length ? Math.round((contacted / srcOpps.length) * 100) : 0;
                    return (
                      <tr key={src} className="border-b border-gray-800/50 last:border-0">
                        <td className="px-4 py-2.5 text-white text-xs font-medium">{SOURCE_LABEL[src]}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{srcOpps.length}</td>
                        <td className="px-4 py-2.5 text-right text-gray-400 text-xs">{contacted}</td>
                        <td className="px-4 py-2.5 text-right text-amber-400 text-xs">{booked}</td>
                        <td className="px-4 py-2.5 text-right text-green-400 font-bold text-xs">{won}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          <span className={contactPct >= 50 ? "text-green-400" : contactPct >= 20 ? "text-amber-400" : "text-gray-600"}>
                            {contactPct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Response time insight */}
            {(() => {
              const contacted = opps.filter(o => o.contacted_at && o.created_at);
              if (contacted.length < 3) return null;
              const avgHours = contacted.reduce((sum, o) => {
                return sum + (new Date(o.contacted_at!).getTime() - new Date(o.created_at).getTime()) / 3600000;
              }, 0) / contacted.length;
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500">
                    Average response time: <span className={`font-bold ${avgHours < 2 ? "text-green-400" : avgHours < 6 ? "text-amber-400" : "text-red-400"}`}>
                      {avgHours < 1 ? `${Math.round(avgHours * 60)}m` : `${avgHours.toFixed(1)}h`}
                    </span>
                    <span className="text-gray-600 ml-2">(target: under 2h — first responder wins)</span>
                  </p>
                </div>
              );
            })()}
          </section>
        )}
      </div>
    </div>
  );
}
