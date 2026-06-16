"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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
  stage: string;
  lastRun: CronLog | null;
}

interface Opportunity {
  id: string;
  source: string;
  type: string;
  title: string;
  priority: "high" | "medium" | "low";
  status: string;
  created_at: string;
  why_it_matters: string | null;
  urgency_score: number;
  outreach_message: string | null;
  location: string | null;
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

interface StatusData {
  timestamp: string;
  activity_level: "high" | "medium" | "low";
  recent_cron_count: number;
  cron_status: CronStatus[];
  recent_activity: CronLog[];
  pipeline: {
    detect: { count: number; label: string; sublabel: string };
    reach:  { count: number; label: string; sublabel: string };
    nurture:{ count: number; label: string; sublabel: string };
    win:    { count: number; label: string; sublabel: string };
  };
  leads: {
    today: number;
    this_week: number;
    with_phone: number;
    by_source: Record<string, number>;
    recent: Array<{ name: string | null; city: string | null; source: string; created_at: string; has_phone: boolean; score: number | null }>;
  };
  outbound: {
    total_prospects: number;
    by_status: Record<string, number>;
    by_segment: Record<string, number>;
    new: number;
    in_sequence: number;
    replied: number;
  };
  contact_forms: {
    pending: number;
    auto_sent: number;
    total: number;
    queue: ContactFormItem[];
  };
  opportunities: {
    total: number;
    high_priority: number;
    recent: Opportunity[];
  };
  blog: {
    posts_total: number;
    recent: Array<{ title: string; created_at: string; target_keyword: string | null }>;
  };
  storm: {
    last_detected: { cities: string[]; hail_size_inches: number | null; detected_at: string } | null;
    hours_ago: number | null;
    active: boolean;
  };
  meta_ads: {
    active_campaigns: number;
    total_daily_budget_cents: number;
    campaigns: Array<{ zip_code: string; city: string; daily_budget_cents: number }>;
  };
}

// ── Pipeline stage config ─────────────────────────────────────────────────────

const STAGES = [
  {
    id: "detect",
    label: "DETECT",
    icon: "◎",
    description: "Find signals",
    color: "amber",
    tw: {
      bg: "bg-amber-950/60",
      border: "border-amber-800/60",
      text: "text-amber-400",
      badge: "bg-amber-900 text-amber-300",
      dot: "bg-amber-400",
      bar: "bg-amber-500",
      glow: "shadow-amber-900/60",
    },
    systems: [
      "Storm Monitor", "Permit Scanner", "Competitor Reviews",
      "Pending Sales", "HOA Violations", "Unclaimed Damage", "FEMA Monitor", "Gov't Bids",
    ],
  },
  {
    id: "reach",
    label: "REACH",
    icon: "→",
    description: "Make contact",
    color: "blue",
    tw: {
      bg: "bg-blue-950/60",
      border: "border-blue-800/60",
      text: "text-blue-400",
      badge: "bg-blue-900 text-blue-300",
      dot: "bg-blue-400",
      bar: "bg-blue-500",
      glow: "shadow-blue-900/60",
    },
    systems: ["Prospect Scraper", "Cold Email Engine", "Form Auto-Submitter", "SEO Blog Writer"],
  },
  {
    id: "nurture",
    label: "NURTURE",
    icon: "↻",
    description: "Warm them up",
    color: "violet",
    tw: {
      bg: "bg-violet-950/60",
      border: "border-violet-800/60",
      text: "text-violet-400",
      badge: "bg-violet-900 text-violet-300",
      dot: "bg-violet-400",
      bar: "bg-violet-500",
      glow: "shadow-violet-900/60",
    },
    systems: ["Lead Follow-up Drip", "Intel Digest", "Facebook Ad Manager"],
  },
  {
    id: "win",
    label: "WIN",
    icon: "✓",
    description: "Lead captured",
    color: "emerald",
    tw: {
      bg: "bg-emerald-950/60",
      border: "border-emerald-800/60",
      text: "text-emerald-400",
      badge: "bg-emerald-900 text-emerald-300",
      dot: "bg-emerald-400",
      bar: "bg-emerald-500",
      glow: "shadow-emerald-900/60",
    },
    systems: ["Review Harvester", "Weekly Report"],
  },
] as const;

type StageId = typeof STAGES[number]["id"];

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

function stageForCron(cronName: string, cronStatus: CronStatus[]): StageId | null {
  const cron = cronStatus.find(c => c.name === cronName);
  return (cron?.stage as StageId) || null;
}

function cronEventNarrative(log: CronLog): string {
  const n = {
    "storm-check":          "Scanned NWS for Colorado hail events",
    "permit-monitor":       "Pulled Denver building permit records",
    "competitor-reviews":   "Mined Google + Yelp for angry competitor reviews",
    "listing-monitor":      "Checked Redfin for new pending home sales",
    "hoa-violations":       "Scraped HOA directories for management companies to prospect",
    "hail-damage-unclaimed":"Cross-referenced storm history vs permit records",
    "fema-monitor":         "Checked FEMA disaster declarations",
    "bid-monitor":          "Scanned CO procurement portals for roofing RFPs",
    "prospect-scraper":     "Scraped OSM Overpass API for referral partners",
    "outbound-prospect":    "Sent personalized cold emails to referral targets",
    "contact-form-targets": "Auto-submitted contact forms for no-email prospects",
    "blog-generate":        "Published SEO blog content for Front Range searches",
    "follow-up":            "Sent drip follow-ups to captured leads",
    "intel-digest":         "Emailed Tyler the top opportunities digest",
    "meta-ad-cleanup":      "Checked Facebook storm ads for auto-pause",
    "review-request":       "Requested Google reviews from recent job completions",
    "weekly-report":        "Compiled weekly performance report",
  }[log.cron_name] || log.cron_name.replace(/-/g, " ");
  return n;
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

function stageOf(cronName: string): StageId {
  const map: Record<string, StageId> = {
    "storm-check": "detect", "permit-monitor": "detect",
    "competitor-reviews": "detect", "listing-monitor": "detect", "hoa-violations": "detect",
    "hail-damage-unclaimed": "detect", "fema-monitor": "detect", "bid-monitor": "detect",
    "prospect-scraper": "reach", "outbound-prospect": "reach", "contact-form-targets": "reach",
    "blog-generate": "reach",
    "follow-up": "nurture", "intel-digest": "nurture", "meta-ad-cleanup": "nurture",
    "review-request": "win", "weekly-report": "win",
  };
  return map[cronName] || "detect";
}

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

// ── Pipeline Flow (hero section) ──────────────────────────────────────────────

function PipelineFlow({ pipeline, stormActive }: {
  pipeline: StatusData["pipeline"];
  stormActive: boolean;
}) {
  const stages: { key: keyof typeof pipeline; stage: typeof STAGES[number] }[] = [
    { key: "detect",  stage: STAGES[0] },
    { key: "reach",   stage: STAGES[1] },
    { key: "nurture", stage: STAGES[2] },
    { key: "win",     stage: STAGES[3] },
  ];

  return (
    <div className={`relative border rounded-xl p-6 transition-all duration-500 ${
      stormActive
        ? "border-orange-600/60 bg-orange-950/20 shadow-lg shadow-orange-900/30"
        : "border-gray-800 bg-gray-900/40"
    }`}>

      {/* Animated flow connector */}
      <style>{`
        @keyframes flowDot {
          0%   { left: 0%;   opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .flow-dot { animation: flowDot 2.4s linear infinite; }
        .flow-dot-2 { animation: flowDot 2.4s linear 0.8s infinite; }
        .flow-dot-3 { animation: flowDot 2.4s linear 1.6s infinite; }
      `}</style>

      <div className="flex items-stretch gap-0">
        {stages.map(({ key, stage }, i) => {
          const data = pipeline[key];
          const isLast = i === stages.length - 1;
          return (
            <div key={key} className="flex items-center flex-1 min-w-0">
              {/* Stage card */}
              <div className={`flex-1 min-w-0 rounded-xl border p-4 ${stage.tw.bg} ${stage.tw.border} ${key === "win" ? `shadow-lg ${stage.tw.glow}` : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.tw.dot} ${key === "detect" && stormActive ? "animate-pulse" : ""}`} />
                  <span className={`text-xs font-mono font-bold tracking-widest ${stage.tw.text}`}>{stage.label}</span>
                  <span className="text-xs text-gray-600 ml-auto">{stage.description}</span>
                </div>

                <div className="flex items-end gap-2 mb-3">
                  <span className={`text-4xl font-mono font-black ${stage.tw.text} leading-none`}>
                    {data.count.toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-gray-400 mb-1">{data.label}</div>
                <div className="text-xs text-gray-600">{data.sublabel}</div>

                {/* Systems feeding this stage */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {stage.systems.map(sys => (
                    <span key={sys} className={`text-[10px] px-1.5 py-0.5 rounded ${stage.tw.badge} font-mono`}>
                      {sys}
                    </span>
                  ))}
                </div>
              </div>

              {/* Animated connector */}
              {!isLast && (
                <div className="relative flex-shrink-0 w-10 h-2 mx-1">
                  <div className="absolute inset-y-0 left-0 right-0 my-auto h-px bg-gray-700" />
                  <div className={`flow-dot   absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${stage.tw.dot}`} />
                  <div className={`flow-dot-2 absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${stage.tw.dot}`} />
                  <div className={`flow-dot-3 absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${stage.tw.dot}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Cron Status Grid ──────────────────────────────────────────────────────────

function CronsByStage({ cronStatus }: { cronStatus: CronStatus[] }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {STAGES.map(stage => {
        const jobs = cronStatus.filter(c => c.stage === stage.id);
        const allOk = jobs.every(j => !j.lastRun || j.lastRun.result === "success");
        const anyRunning = jobs.some(j => j.lastRun && !j.lastRun.finished_at);

        return (
          <div key={stage.id} className={`rounded-xl border p-4 ${stage.tw.bg} ${stage.tw.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-lg ${stage.tw.text}`}>{stage.icon}</span>
              <span className={`text-xs font-mono font-bold tracking-widest ${stage.tw.text}`}>{stage.label}</span>
              <div className={`ml-auto w-2 h-2 rounded-full ${
                anyRunning ? `${stage.tw.dot} animate-pulse`
                  : allOk ? "bg-emerald-500"
                  : "bg-red-500"
              }`} />
            </div>

            <div className="space-y-1.5">
              {jobs.map(job => {
                const ok = job.lastRun?.result === "success";
                const running = job.lastRun && !job.lastRun.finished_at;
                const hasRun = !!job.lastRun;
                return (
                  <div key={job.name} className="flex items-center gap-2 group">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      running ? `${stage.tw.dot} animate-pulse`
                        : !hasRun ? "bg-gray-700"
                        : ok ? "bg-emerald-500"
                        : "bg-red-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-300 truncate">{job.label}</div>
                      <div className="text-[10px] text-gray-600 font-mono">
                        {job.lastRun ? timeAgo(job.lastRun.started_at) : job.schedule}
                        {job.lastRun?.actions_taken ? ` · +${job.lastRun.actions_taken}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Live Activity Feed ────────────────────────────────────────────────────────

function LiveFeed({ logs }: { logs: CronLog[] }) {
  const feedRef = useRef<HTMLDivElement>(null);

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm font-mono">
        waiting for Anna to start...
      </div>
    );
  }

  return (
    <div ref={feedRef} className="space-y-0 overflow-y-auto max-h-full pr-1">
      {logs.map((log, i) => {
        const stage = stageOf(log.cron_name);
        const stageConfig = STAGE_MAP[stage];
        const ok = log.result === "success";
        const running = !log.finished_at;
        const narrative = cronEventNarrative(log);

        return (
          <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-800/40 last:border-0">
            {/* Stage color bar */}
            <div className={`mt-1 w-1 self-stretch rounded-full flex-shrink-0 ${
              running ? `${stageConfig.tw.dot} animate-pulse`
              : ok ? stageConfig.tw.dot
              : "bg-red-500"
            }`} style={{ minHeight: 16 }} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono font-bold tracking-widest ${stageConfig.tw.text}`}>
                  {stage.toUpperCase()}
                </span>
                <span className="text-xs text-gray-300 flex-1 min-w-0">{narrative}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {log.actions_taken > 0 && (
                  <span className="text-[10px] font-mono text-cyan-400">+{log.actions_taken} actions</span>
                )}
                {log.leads_generated > 0 && (
                  <span className="text-[10px] font-mono text-emerald-400">+{log.leads_generated} leads</span>
                )}
                {log.error && (
                  <span className="text-[10px] text-red-400 truncate">{log.error}</span>
                )}
              </div>
            </div>

            <div className="text-[10px] text-gray-600 font-mono flex-shrink-0 pt-0.5">
              {running ? "running…" : timeAgo(log.started_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Intel Panel ───────────────────────────────────────────────────────────────

function IntelPanel({ opportunities, stormActive, metaAds }: {
  opportunities: Opportunity[];
  stormActive: boolean;
  metaAds: StatusData["meta_ads"];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const sourceIcon: Record<string, string> = {
    storm: "⚡",
    community_import: "⭐",
    property_scan: "🏠",
  };

  return (
    <div className="space-y-2 overflow-y-auto max-h-full">
      {/* Meta ads banner if active */}
      {metaAds.active_campaigns > 0 && (
        <div className="rounded-lg border border-blue-800/50 bg-blue-950/40 px-3 py-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-300 font-semibold">{metaAds.active_campaigns} Facebook ads running</span>
            <span className="text-xs text-blue-500 ml-2">${(metaAds.total_daily_budget_cents / 100).toFixed(0)}/day</span>
          </div>
          <span className="text-[10px] text-blue-600 font-mono">auto-pause in 7d</span>
        </div>
      )}

      {/* Storm mode banner */}
      {stormActive && (
        <div className="rounded-lg border border-orange-700/50 bg-orange-950/40 px-3 py-2 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
          <span className="text-xs text-orange-300 font-semibold">Storm mode active — all channels firing</span>
        </div>
      )}

      {opportunities.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">Intel building up...</div>
      ) : (
        opportunities.map(opp => {
          const isHigh = opp.priority === "high";
          const isExp = expanded === opp.id;
          return (
            <button
              key={opp.id}
              onClick={() => setExpanded(isExp ? null : opp.id)}
              className={`w-full text-left rounded-lg border transition-all ${
                isHigh
                  ? "border-orange-800/60 bg-orange-950/30 hover:bg-orange-950/50"
                  : "border-gray-800 bg-gray-900/50 hover:bg-gray-900"
              }`}
            >
              <div className="flex items-start gap-2 p-3">
                <span className="text-sm flex-shrink-0 mt-0.5">
                  {sourceIcon[opp.source] || "🎯"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs leading-tight font-medium ${isHigh ? "text-orange-200" : "text-gray-300"}`}>
                    {opp.title.slice(0, 90)}{opp.title.length > 90 ? "…" : ""}
                  </div>
                  {opp.location && (
                    <div className="text-[10px] text-gray-500 mt-0.5">{opp.location}</div>
                  )}
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    isHigh ? "bg-orange-900 text-orange-300" : "bg-gray-800 text-gray-500"
                  }`}>{opp.urgency_score}</span>
                  <span className="text-[10px] text-gray-600">{timeAgo(opp.created_at)}</span>
                </div>
              </div>

              {isExp && opp.outreach_message && (
                <div className="border-t border-gray-800 px-3 pb-3 pt-2">
                  <div className="text-[10px] text-gray-500 mb-1 font-mono">ANNA'S OUTREACH</div>
                  <div className="text-xs text-gray-300 leading-relaxed bg-gray-950 rounded p-2">
                    {opp.outreach_message}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(opp.outreach_message!); }}
                    className="text-[10px] text-gray-600 hover:text-gray-400 mt-1.5 transition"
                  >
                    copy →
                  </button>
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}

// ── Recent Leads ──────────────────────────────────────────────────────────────

function RecentLeads({ leads }: { leads: StatusData["leads"]["recent"] }) {
  if (leads.length === 0) {
    return <div className="text-gray-600 text-xs text-center py-4">No leads this week yet.</div>;
  }
  return (
    <div className="space-y-1.5">
      {leads.map((lead, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-800/40 last:border-0">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${lead.has_phone ? "bg-emerald-400" : "bg-gray-600"}`} />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-300">{lead.name || "Anonymous"}</span>
            {lead.city && <span className="text-xs text-gray-500 ml-2">{lead.city}</span>}
          </div>
          <span className="text-[10px] text-gray-600 font-mono capitalize">{(lead.source || "").replace(/_/g, " ")}</span>
          <span className="text-[10px] text-gray-600 font-mono">{timeAgo(lead.created_at)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Outbound Breakdown ────────────────────────────────────────────────────────

function OutboundBreakdown({ outbound, contactForms }: {
  outbound: StatusData["outbound"];
  contactForms: StatusData["contact_forms"];
}) {
  const segments = Object.entries(outbound.by_segment).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = outbound.total_prospects || 1;

  return (
    <div className="space-y-4">
      {/* Funnel counts */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Queued", value: outbound.new, color: "text-gray-400" },
          { label: "In Touch", value: outbound.in_sequence, color: "text-blue-400" },
          { label: "Replied", value: outbound.replied, color: "text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-900 rounded-lg p-3 text-center">
            <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Form auto-submit stats */}
      <div className="flex items-center gap-3 text-xs bg-gray-900 rounded-lg px-3 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
        <span className="text-gray-400">{contactForms.auto_sent} forms auto-submitted</span>
        <span className="text-gray-600 mx-1">·</span>
        <span className="text-yellow-400">{contactForms.pending} awaiting manual send</span>
      </div>

      {/* Segment bars */}
      <div className="space-y-2">
        {segments.map(([seg, count]) => (
          <div key={seg} className="flex items-center gap-2">
            <div className="text-[10px] text-gray-500 w-28 flex-shrink-0 truncate">{segmentLabel(seg)}</div>
            <div className="flex-1 bg-gray-800 rounded-full h-1 overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <div className="text-[10px] text-gray-600 font-mono w-5 text-right">{count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnnaWarRoom() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/anna/status");
      if (!res.ok) return;
      setData(await res.json());
      setLastRefresh(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const stormActive = data?.storm.active ?? false;
  const activityLevel = data?.activity_level ?? "low";

  return (
    <div className={`min-h-screen bg-gray-950 text-white font-sans transition-colors duration-1000 ${
      stormActive ? "bg-gray-950" : ""
    }`}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={`border-b px-6 py-3 flex items-center justify-between transition-colors duration-500 ${
        stormActive ? "border-orange-800/50 bg-orange-950/10" : "border-gray-800"
      }`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              activityLevel === "high" ? "bg-emerald-400 animate-pulse"
              : activityLevel === "medium" ? "bg-yellow-400"
              : "bg-gray-600"
            }`} />
            <span className="text-lg font-bold tracking-tight">Anna</span>
            <span className="text-gray-600 text-sm">/ war room</span>
          </div>

          {/* Status tag */}
          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
            activityLevel === "high"
              ? "text-emerald-400 border-emerald-800 bg-emerald-950"
              : activityLevel === "medium"
              ? "text-yellow-400 border-yellow-800 bg-yellow-950"
              : "text-gray-500 border-gray-700"
          }`}>
            {activityLevel === "high" ? "ACTIVE" : activityLevel === "medium" ? "RUNNING" : "STANDBY"}
            {data && <span className="ml-1.5 opacity-60">{data.recent_cron_count} jobs / 2h</span>}
          </span>

          {/* Storm inline badge */}
          {stormActive && data?.storm.last_detected && (
            <div className="flex items-center gap-2 bg-orange-950 border border-orange-700 rounded-full px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs text-orange-300 font-semibold">
                ⚡ Storm — {data.storm.last_detected.cities.slice(0, 2).join(", ")}
                {data.storm.last_detected.hail_size_inches ? ` · ${data.storm.last_detected.hail_size_inches}"` : ""}
              </span>
              <span className="text-xs text-orange-600">{data.storm.hours_ago}h ago</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-600 font-mono">
          {lastRefresh && <span>updated {timeAgo(lastRefresh.toISOString())}</span>}
          <button
            onClick={fetchData}
            className="border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-gray-400 transition text-xs"
          >
            refresh
          </button>
          <a href="/intel" className="border border-gray-700 rounded px-2 py-1 hover:border-gray-500 hover:text-gray-400 transition text-xs">
            /intel →
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-[80vh] gap-3 text-gray-600 font-mono text-sm">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-1.5 h-6 rounded-full animate-pulse ${STAGES[i % 4].tw.dot}`}
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          connecting to Anna…
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-96 text-red-400 font-mono text-sm">
          could not reach /api/anna/status — check Supabase connection
        </div>
      ) : (
        <div className="p-5 space-y-5">

          {/* ── Pipeline Hero ─────────────────────────────────────────── */}
          <PipelineFlow pipeline={data.pipeline} stormActive={stormActive} />

          {/* ── Cron systems by stage ─────────────────────────────────── */}
          <CronsByStage cronStatus={data.cron_status} />

          {/* ── KPI strip ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[
              { label: "Leads Today",      value: data.leads.today,               color: "text-emerald-400" },
              { label: "With Phone",       value: data.leads.with_phone,          color: "text-emerald-300" },
              { label: "This Week",        value: data.leads.this_week,           color: "text-white" },
              { label: "Prospects",        value: data.outbound.total_prospects,  color: "text-blue-400" },
              { label: "In Sequence",      value: data.outbound.in_sequence,      color: "text-blue-300" },
              { label: "Forms Auto-Sent",  value: data.contact_forms.auto_sent,   color: "text-violet-400" },
              { label: "Intel Opps",       value: data.opportunities.total,       color: "text-amber-400" },
              { label: "High Priority",    value: data.opportunities.high_priority,color: "text-orange-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
                <div className={`text-2xl font-mono font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── Main 3-column content ─────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Live feed (2/5) */}
            <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col" style={{ minHeight: 480 }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
                <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Live Activity</h2>
                <div className={`flex items-center gap-1.5 text-[10px] font-mono ${
                  activityLevel === "high" ? "text-emerald-400" : "text-gray-600"
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    activityLevel === "high" ? "bg-emerald-400 animate-pulse" : "bg-gray-700"
                  }`} />
                  {activityLevel === "high" ? "all systems go" : "monitoring"}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-2" style={{ maxHeight: 520 }}>
                <LiveFeed logs={data.recent_activity} />
              </div>
            </div>

            {/* Intel panel (2/5) */}
            <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl flex flex-col" style={{ minHeight: 480 }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
                <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Intel — Act Now</h2>
                {data.opportunities.high_priority > 0 && (
                  <span className="text-[10px] font-mono bg-orange-900 text-orange-400 px-2 py-0.5 rounded-full">
                    {data.opportunities.high_priority} hot
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3" style={{ maxHeight: 520 }}>
                <IntelPanel
                  opportunities={data.opportunities.recent}
                  stormActive={stormActive}
                  metaAds={data.meta_ads}
                />
              </div>
            </div>

            {/* Right sidebar (1/5) */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              {/* Recent leads */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">Recent Leads</h2>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <RecentLeads leads={data.leads.recent} />
              </div>

              {/* Lead sources */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">Sources (7d)</h2>
                {Object.keys(data.leads.by_source).length === 0 ? (
                  <div className="text-xs text-gray-600 py-2 text-center">No leads yet</div>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(data.leads.by_source).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                      <div key={src} className="flex items-center gap-2">
                        <div className="text-[10px] text-gray-500 w-20 flex-shrink-0 truncate capitalize">
                          {src.replace(/_/g, " ")}
                        </div>
                        <div className="flex-1 bg-gray-800 rounded-full h-1 overflow-hidden">
                          <div className="bg-emerald-600 h-full rounded-full"
                            style={{ width: `${(count / (data.leads.this_week || 1)) * 100}%` }} />
                        </div>
                        <div className="text-[10px] text-gray-600 font-mono w-4 text-right">{count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom row ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Outbound pipeline */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest mb-4">
                Outbound Pipeline — {data.outbound.total_prospects.toLocaleString()} prospects loaded
              </h2>
              <OutboundBreakdown outbound={data.outbound} contactForms={data.contact_forms} />
            </div>

            {/* Blog + SEO */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">SEO Content</h2>
                <span className="text-[10px] text-gray-600 font-mono">{data.blog.posts_total} total posts</span>
              </div>
              {data.blog.recent.length === 0 ? (
                <div className="text-xs text-gray-600 py-4 text-center">
                  Blog generator runs Mondays — posts appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.blog.recent.map((post, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                      <div className="w-1 h-1 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-300 leading-tight truncate">{post.title}</div>
                        {post.target_keyword && (
                          <div className="text-[10px] text-gray-600 font-mono mt-0.5">
                            /{post.target_keyword}/
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono flex-shrink-0">{timeAgo(post.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
