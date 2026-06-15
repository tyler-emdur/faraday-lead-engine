"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronLog {
  cron_name: string;
  started_at: string;
  finished_at: string | null;
  result: "success" | "error" | null;
  leads_generated: number;
  actions_taken: number;
  duration_ms: number | null;
  error: string | null;
}

interface CronStatus {
  name: string;
  label: string;
  schedule: string;
  lastRun: CronLog | null;
}

interface ContactFormItem {
  id: string;
  business_name: string;
  website: string;
  source: string;
  city: string | null;
  drafted_message: string;
  status: string;
  queued_at: string;
}

interface Opportunity {
  id: string;
  source: string;
  type: string;
  title: string;
  priority: string;
  status: string;
  created_at: string;
  why_it_matters: string | null;
  urgency_score: number;
}

interface StatusData {
  timestamp: string;
  activity_level: "high" | "medium" | "low";
  recent_cron_count: number;
  cron_status: CronStatus[];
  recent_activity: CronLog[];
  leads: {
    today: number;
    this_week: number;
    by_source: Record<string, number>;
    recent: Array<{ city: string; source: string; created_at: string }>;
  };
  outbound: {
    total_prospects: number;
    by_status: Record<string, number>;
    by_touch: Record<string, number>;
    by_segment: Record<string, number>;
    new: number;
    in_sequence: number;
    replied: number;
  };
  contact_forms: {
    pending: number;
    total: number;
    queue: ContactFormItem[];
  };
  opportunities: {
    total: number;
    high_priority: number;
    recent: Opportunity[];
  };
  blog: { posts_total: number; recent: Array<{ title: string; created_at: string }> };
  storm: { last_detected: { city: string; hail_size_inches: number; created_at: string } | null; hours_ago: number | null; active: boolean };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function segmentLabel(s: string): string {
  return ({
    insurance_agent: "Insurance Agents",
    property_manager: "Property Managers",
    hoa_manager: "HOA Managers",
    apartment_manager: "Apartment Managers",
    condo_manager: "Condo Managers",
    mortgage_broker: "Mortgage Brokers",
    title_company: "Title Companies",
    realtor: "Realtors",
  } as Record<string, string>)[s] || s;
}

function cronDisplayName(name: string): string {
  return name.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-3xl font-mono font-bold ${accent || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function ActivityRow({ log }: { log: CronLog }) {
  const ok = log.result === "success";
  const running = !log.finished_at;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
      <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${running ? "bg-yellow-400 animate-pulse" : ok ? "bg-emerald-500" : "bg-red-500"}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-300 font-mono">{cronDisplayName(log.cron_name)}</span>
          {log.actions_taken > 0 && <span className="text-xs text-cyan-400 font-mono">+{log.actions_taken} actions</span>}
          {log.leads_generated > 0 && <span className="text-xs text-emerald-400 font-mono">+{log.leads_generated} leads</span>}
        </div>
        {log.error && <div className="text-xs text-red-400 truncate">{log.error}</div>}
      </div>
      <div className="text-xs text-gray-600 flex-shrink-0 font-mono">{timeAgo(log.started_at)}</div>
    </div>
  );
}

function CronGrid({ jobs }: { jobs: CronStatus[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {jobs.map(job => {
        const lr = job.lastRun;
        const ok = lr?.result === "success";
        const hasRun = !!lr;
        return (
          <div key={job.name} className="flex items-center gap-2 bg-gray-900 rounded px-3 py-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${!hasRun ? "bg-gray-700" : ok ? "bg-emerald-500" : "bg-red-500"}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-300 truncate">{job.label}</div>
              <div className="text-xs text-gray-600 font-mono">{lr ? timeAgo(lr.started_at) : "never"} · {job.schedule}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutboundPipeline({ outbound }: { outbound: StatusData["outbound"] }) {
  const segments = Object.entries(outbound.by_segment).sort((a, b) => b[1] - a[1]);
  const total = outbound.total_prospects || 1;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-2xl font-mono font-bold text-white">{outbound.new}</div>
          <div className="text-xs text-gray-500">New</div>
        </div>
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-2xl font-mono font-bold text-cyan-400">{outbound.in_sequence}</div>
          <div className="text-xs text-gray-500">In Sequence</div>
        </div>
        <div className="bg-gray-900 rounded p-3 text-center">
          <div className="text-2xl font-mono font-bold text-emerald-400">{outbound.replied}</div>
          <div className="text-xs text-gray-500">Replied</div>
        </div>
      </div>

      {segments.length > 0 && (
        <div className="space-y-2">
          {segments.map(([seg, count]) => (
            <div key={seg} className="flex items-center gap-2">
              <div className="text-xs text-gray-400 w-36 flex-shrink-0 truncate">{segmentLabel(seg)}</div>
              <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-cyan-600 h-full rounded-full" style={{ width: `${(count / total) * 100}%` }} />
              </div>
              <div className="text-xs text-gray-500 font-mono w-6 text-right">{count}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactFormQueue({ items }: { items: ContactFormItem[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (items.length === 0) return (
    <div className="text-center py-6 text-gray-600 text-sm">
      No pending drafts yet.<br />Run <span className="font-mono text-gray-500">trigger-crons.sh</span> to generate them.
    </div>
  );
  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {items.map(item => (
        <div key={item.id} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/50 transition"
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <div className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-200 font-medium truncate">{item.business_name}</div>
              <div className="text-xs text-gray-500">{item.city} · {segmentLabel(item.source)}</div>
            </div>
            <div className="text-xs text-gray-600 font-mono flex-shrink-0">{timeAgo(item.queued_at)}</div>
            <div className={`text-gray-500 text-xs ml-1 ${expanded === item.id ? "rotate-90" : ""} transition-transform`}>▶</div>
          </button>
          {expanded === item.id && (
            <div className="border-t border-gray-800 p-3 space-y-2">
              <a href={item.website} target="_blank" rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:underline block truncate">{item.website}</a>
              <div className="bg-gray-950 rounded p-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {item.drafted_message}
              </div>
              <button
                className="text-xs text-gray-500 hover:text-white transition"
                onClick={() => { navigator.clipboard.writeText(item.drafted_message); }}
              >
                Copy message
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function OpportunityFeed({ items }: { items: Opportunity[] }) {
  if (items.length === 0) return (
    <div className="text-center py-6 text-gray-600 text-sm">No opportunities yet.</div>
  );
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {items.map(opp => (
        <div key={opp.id} className="flex items-start gap-3 py-2 border-b border-gray-800/50 last:border-0">
          <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
            opp.priority === "high" ? "bg-orange-400" : opp.priority === "medium" ? "bg-yellow-600" : "bg-gray-600"
          }`} />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-300 leading-tight truncate">{opp.title}</div>
            {opp.why_it_matters && (
              <div className="text-xs text-gray-500 mt-0.5 truncate">{opp.why_it_matters}</div>
            )}
            <div className="text-xs text-gray-600 font-mono mt-0.5">{opp.source} · score {opp.urgency_score}</div>
          </div>
          <div className="text-xs text-gray-600 flex-shrink-0 font-mono">{timeAgo(opp.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnnaWarRoom() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch("/api/anna/status");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_();
    const interval = setInterval(fetch_, 30000);
    const tickInterval = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(interval); clearInterval(tickInterval); };
  }, [fetch_]);

  const activityColor = data?.activity_level === "high"
    ? "text-emerald-400"
    : data?.activity_level === "medium"
    ? "text-yellow-400"
    : "text-gray-500";

  const activityLabel = data?.activity_level === "high"
    ? "ACTIVE — working multiple channels"
    : data?.activity_level === "medium"
    ? "RUNNING — checking sources"
    : "STANDBY";

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${data?.activity_level === "high" ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-xl font-bold tracking-tight">Anna</span>
            <span className="text-gray-600 text-sm">/ war room</span>
          </div>
          {data && (
            <span className={`text-xs font-mono ${activityColor}`}>{activityLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-600 font-mono">
          <span>auto-refresh 30s</span>
          {lastRefresh && <span>updated {timeAgo(lastRefresh.toISOString())}</span>}
          <button
            onClick={fetch_}
            className="border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-gray-400 transition"
          >
            refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 text-gray-600 font-mono text-sm">
          connecting to Anna...
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-96 text-red-400 font-mono text-sm">
          could not reach /api/anna/status — check Supabase connection
        </div>
      ) : (
        <div className="p-6 space-y-6">

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Leads Today" value={data.leads.today} sub="all sources" accent="text-emerald-400" />
            <StatCard label="Leads This Week" value={data.leads.this_week} sub="7 days" />
            <StatCard label="Prospects Loaded" value={data.outbound.total_prospects} sub="outbound queue" accent="text-cyan-400" />
            <StatCard label="In Email Sequence" value={data.outbound.in_sequence} sub="active touches" accent="text-cyan-400" />
            <StatCard label="Contact Form Drafts" value={data.contact_forms.pending} sub="ready to send" accent="text-yellow-400" />
            <StatCard label="Intel Opportunities" value={data.opportunities.total} sub={`${data.opportunities.high_priority} high priority`} accent="text-orange-400" />
          </div>

          {/* Storm alert banner (if active) */}
          {data.storm.active && data.storm.last_detected && (
            <div className="bg-orange-950 border border-orange-700 rounded-lg px-5 py-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
              <div>
                <span className="font-semibold text-orange-300">Storm detected {data.storm.hours_ago}h ago — </span>
                <span className="text-orange-200">
                  {data.storm.last_detected.city} · {data.storm.last_detected.hail_size_inches}" hail
                </span>
                <span className="text-orange-500 text-sm ml-3">Storm cron is re-engaging past leads + posted to Facebook</span>
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Live Activity Feed */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Live Activity</h2>
                <span className="text-xs text-gray-600 font-mono">{data.recent_cron_count} runs / 2h</span>
              </div>
              {data.recent_activity.length === 0 ? (
                <div className="text-gray-600 text-sm text-center py-8">
                  No activity yet.<br />Run <span className="font-mono">trigger-crons.sh</span> to start.
                </div>
              ) : (
                <div className="space-y-0.5 max-h-96 overflow-y-auto pr-1">
                  {data.recent_activity.map((log, i) => (
                    <ActivityRow key={i} log={log} />
                  ))}
                </div>
              )}
            </div>

            {/* Middle: Outbound Pipeline + Contact Form Queue */}
            <div className="space-y-6">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Outbound Campaign</h2>
                <OutboundPipeline outbound={data.outbound} />
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Contact Form Queue</h2>
                  {data.contact_forms.pending > 0 && (
                    <span className="text-xs font-mono bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded">
                      {data.contact_forms.pending} ready
                    </span>
                  )}
                </div>
                <ContactFormQueue items={data.contact_forms.queue} />
              </div>
            </div>

            {/* Right: Cron Schedule + Intel */}
            <div className="space-y-6">
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Anna&apos;s Cron Jobs</h2>
                <CronGrid jobs={data.cron_status} />
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Intel Feed</h2>
                  {data.opportunities.high_priority > 0 && (
                    <span className="text-xs font-mono bg-orange-900 text-orange-400 px-2 py-0.5 rounded">
                      {data.opportunities.high_priority} hot
                    </span>
                  )}
                </div>
                <OpportunityFeed items={data.opportunities.recent} />
              </div>
            </div>
          </div>

          {/* Bottom: Leads by source + Blog */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Leads by Source (7 days)</h2>
              {Object.keys(data.leads.by_source).length === 0 ? (
                <div className="text-gray-600 text-sm py-4 text-center">No leads yet this week.</div>
              ) : (
                Object.entries(data.leads.by_source)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <div key={src} className="flex items-center gap-3">
                      <div className="text-xs text-gray-400 w-36 flex-shrink-0 capitalize">{src.replace(/_/g, " ")}</div>
                      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full"
                          style={{ width: `${(count / (data.leads.this_week || 1)) * 100}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 font-mono w-4 text-right">{count}</div>
                    </div>
                  ))
              )}
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">SEO Blog Posts</h2>
              {data.blog.recent.length === 0 ? (
                <div className="text-gray-600 text-sm py-4 text-center">No posts yet. Blog generator runs Mondays.</div>
              ) : (
                data.blog.recent.map((post, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                    <div className="text-sm text-gray-300 flex-1 truncate">{post.title}</div>
                    <div className="text-xs text-gray-600 font-mono flex-shrink-0">{timeAgo(post.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
