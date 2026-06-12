"use client";

import { useState, useEffect } from "react";

interface StormAlert {
  id: string;
  has_hail: boolean;
  affected_cities?: string[];
  headline?: string;
  detected_at: string;
}

export default function StormBanner() {
  const [storm, setStorm] = useState<StormAlert | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/storms?limit=5")
      .then((r) => r.json())
      .then((data) => {
        const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
        const recent = (data.storms || []).find((s: StormAlert) => {
          const age = Date.now() - new Date(s.detected_at).getTime();
          return s.has_hail && age < WINDOW_MS;
        });
        if (recent) setStorm(recent);
      })
      .catch(() => {});
  }, []);

  if (!storm || dismissed) return null;

  const city = storm.affected_cities?.[0] || "the Front Range";

  return (
    <div className="bg-red-950/80 border-b border-red-900/60 text-red-100">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <span className="text-red-400 shrink-0 text-base">⚡</span>
        <p className="text-sm flex-1 leading-snug">
          <strong className="text-red-200">Hail recently hit {city}.</strong>{" "}
          Your roof may already be covered by insurance —{" "}
          <a
            href="#chat"
            className="underline underline-offset-2 font-semibold text-red-200 hover:text-white transition-colors"
          >
            get a free inspection before the claim window closes →
          </a>
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-500 hover:text-red-300 shrink-0 transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
