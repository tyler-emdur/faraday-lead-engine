"use client";

import { useState, useEffect } from "react";

const NOTIFICATIONS = [
  { name: "Sarah M.", city: "Longmont", service: "hail damage", mins: 4 },
  { name: "James R.", city: "Fort Collins", service: "roof replacement", mins: 11 },
  { name: "Linda K.", city: "Aurora", service: "new windows", mins: 18 },
  { name: "Mike T.", city: "Boulder", service: "hail damage", mins: 25 },
  { name: "Karen B.", city: "Thornton", service: "solar install", mins: 37 },
  { name: "Dave W.", city: "Broomfield", service: "roof inspection", mins: 44 },
  { name: "Ashley P.", city: "Westminster", service: "hail damage", mins: 52 },
  { name: "Tom H.", city: "Arvada", service: "roof replacement", mins: 61 },
  { name: "Jessica L.", city: "Denver", service: "hail damage", mins: 73 },
  { name: "Chris N.", city: "Castle Rock", service: "solar install", mins: 88 },
  { name: "Maria G.", city: "Loveland", service: "new windows", mins: 94 },
  { name: "Ryan C.", city: "Brighton", service: "hail damage", mins: 107 },
];

function formatTime(mins: number): string {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

export default function ActivityTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % NOTIFICATIONS.length);
        setVisible(true);
      }, 400);
    }, 8000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted) return null;

  const n = NOTIFICATIONS[index];

  return (
    <div
      className={`transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="flex items-center gap-2 bg-gray-900/80 border border-gray-800 rounded-full px-4 py-2 text-xs text-gray-400 w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <span>
          <span className="text-gray-200 font-medium">{n.name}</span> from {n.city} just booked a free{" "}
          <span className="text-amber-400">{n.service}</span> inspection
        </span>
        <span className="text-gray-600 shrink-0">· {formatTime(n.mins)}</span>
      </div>
    </div>
  );
}
