"use client";

import { useState, useEffect, useCallback } from "react";

interface StormStatus {
  configured: boolean;
  last_checked: string;
  active_hail_storm: { event: string; cities: string[]; detected_at: string } | null;
  recent_storms_7d: number;
  storm_leads_24h: number;
  total_leads_24h: number;
  sms_blasts_sent: number;
  leads_reengaged: number;
  blogs_posted: number;
  ads_created: number;
  active_subscribers: number;
  last_storm_check: string | null;
  last_storm_check_result: string | null;
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs === 1) return "1 hr ago";
  return `${hrs} hrs ago`;
}

export default function StormLiveStatus() {
  const [status, setStatus] = useState<StormStatus | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [instagramCopied, setInstagramCopied] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/storm-status");
      if (res.ok) setStatus(await res.json());
    } catch {}
    setCountdown(30);
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [poll]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  function copyInstagramStory() {
    const city = status?.active_hail_storm?.cities?.[0] || "your area";
    const text = `🚨 HAIL JUST HIT ${city.toUpperCase()}\n\nFree roof inspection → call or DM us\nInsurance usually covers it 100%\n\n📞 (720) 766-1518\n\n#HailDamage #${city.replace(/\s+/g, "")}CO #FreeInspection #FaradayConstruction`;
    navigator.clipboard.writeText(text).then(() => {
      setInstagramCopied(true);
      setTimeout(() => setInstagramCopied(false), 3000);
    });
  }

  if (!status) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-1/3"></div>
      </div>
    );
  }

  if (!status.configured) return null;

  const hasActiveStorm = !!status.active_hail_storm;

  return (
    <div className={`border rounded-2xl p-4 mb-6 ${hasActiveStorm ? "bg-red-950/30 border-red-900/60" : "bg-gray-900 border-gray-800"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${hasActiveStorm ? "bg-red-400 animate-pulse" : "bg-green-400"}`}></span>
          <span className="text-white font-bold text-sm">
            {hasActiveStorm ? `ACTIVE STORM — ${status.active_hail_storm!.cities.join(", ")}` : "No Active Storm"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveStorm && (
            <button
              onClick={copyInstagramStory}
              className="text-xs bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              {instagramCopied ? "Copied ✓" : "📸 Instagram Story"}
            </button>
          )}
          <span className="text-xs text-gray-600">↺ {countdown}s</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: "Blasts Sent (24h)", value: status.sms_blasts_sent, color: "text-amber-400" },
          { label: "Leads Re-engaged", value: status.leads_reengaged, color: "text-orange-400" },
          { label: "Storm Leads (24h)", value: status.storm_leads_24h, color: "text-red-400" },
          { label: "Opt-in Subscribers", value: status.active_subscribers, color: "text-sky-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900/60 rounded-xl p-3 border border-gray-800/60">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Action status row */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: `${status.blogs_posted} blog${status.blogs_posted !== 1 ? "s" : ""} posted`, ok: status.blogs_posted > 0 },
          { label: `${status.ads_created} ad${status.ads_created !== 1 ? "s" : ""} created`, ok: status.ads_created > 0 },
          { label: `${status.recent_storms_7d} storm${status.recent_storms_7d !== 1 ? "s" : ""} this week`, ok: status.recent_storms_7d > 0 },
          { label: status.last_storm_check ? `Cron ${status.last_storm_check_result || "ok"} ${timeAgo(status.last_storm_check)}` : "Cron never ran", ok: status.last_storm_check_result === "success" },
        ].map(s => (
          <span
            key={s.label}
            className={`text-xs px-2.5 py-1 rounded-full border ${s.ok ? "bg-green-950/40 border-green-900/50 text-green-400" : "bg-gray-800/60 border-gray-700/50 text-gray-500"}`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {hasActiveStorm && (
        <p className="text-xs text-red-400/70 mt-2">
          Detected {timeAgo(status.active_hail_storm!.detected_at)} — post to Nextdoor + FB groups within 2 hrs for best results
        </p>
      )}
    </div>
  );
}
