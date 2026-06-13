"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUtm, utmToSource, utmToSourceDetail } from "@/lib/utm";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LeadData {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null;
  city?: string | null;
  service?: string | null;
  homeowner?: boolean | null;
  roof_age?: number | null;
  damage_visible?: boolean | null;
  damage_description?: string | null;
  insurance_filed?: string | null;
  urgency?: string | null;
  notes?: string | null;
}

interface AnnaResponse {
  message: string;
  data: LeadData;
  complete: boolean;
  chips?: string[];
}

function scoreLead(d: LeadData): number {
  let s = 0;
  if (d.service === "multiple") s += 35;
  else if (d.service === "hail_damage") s += 30;
  else if (d.service === "roofing") s += 22;
  else if (d.service === "solar") s += 20;
  else if (d.service === "windows") s += 18;
  if (d.homeowner === true) s += 12;
  if (d.damage_visible === true) s += 12;
  if (d.damage_description) {
    const desc = d.damage_description.toLowerCase();
    const strong = ["leak", "missing", "broken", "collapsed", "flooding", "interior"];
    const good = ["dent", "granule", "crack", "shingle", "gutter", "vent", "skylight"];
    if (strong.some(w => desc.includes(w))) s += 8;
    else {
      const gc = good.filter(w => desc.includes(w)).length;
      if (gc >= 2) s += 5;
      else if (gc >= 1) s += 3;
      else if (desc.length > 30) s += 2;
    }
  }
  if (d.insurance_filed === "planning_to") s += 10;
  else if (d.insurance_filed === "true") s += 8;
  if (d.roof_age != null) {
    if (d.roof_age >= 20) s += 8;
    else if (d.roof_age >= 15) s += 6;
    else if (d.roof_age >= 10) s += 4;
    else if (d.roof_age >= 5) s += 2;
  }
  if (d.urgency === "emergency") s += 25;
  else if (d.urgency === "immediate") s += 18;
  else if (d.urgency === "this_month") s += 10;
  else if (d.urgency === "exploring") s += 3;
  if (d.phone) s += 6;
  if (d.email) s += 3;
  if (d.zip || d.city) s += 3;
  if (d.phone && d.email) s += 4;
  return Math.min(s, 100);
}

function gradeInfo(score: number) {
  if (score >= 75) return { grade: "A", label: "HOT", color: "text-red-400", bar: "bg-red-500" };
  if (score >= 55) return { grade: "B", label: "WARM", color: "text-amber-400", bar: "bg-amber-500" };
  if (score >= 35) return { grade: "C", label: "COOL", color: "text-blue-400", bar: "bg-blue-500" };
  return { grade: "D", label: "COLD", color: "text-gray-400", bar: "bg-gray-500" };
}

const SERVICE_LABELS: Record<string, string> = {
  roofing: "Roofing",
  hail_damage: "Hail Damage",
  windows: "Windows",
  solar: "Solar",
  multiple: "Multiple Services",
};

const URGENCY_LABELS: Record<string, string> = {
  emergency: "EMERGENCY",
  immediate: "ASAP",
  this_month: "This Month",
  exploring: "Exploring",
};

const INTRO_MESSAGE =
  "Hi! I'm Anna with Faraday Construction. Quick question — are you a homeowner in Colorado? Most people I talk to end up paying nothing out of pocket for their roof. What brought you here today?";

const INTRO_CHIPS = ["Hail/Storm damage", "Roofing", "Solar", "Windows"];

interface ChatWidgetProps {
  compact?: boolean;
  showIntelPanel?: boolean;
  source?: string;
  prefillService?: string;
  sessionKey?: string;
}

export default function ChatWidget({
  compact = false,
  showIntelPanel = false,
  source = "chat",
  prefillService,
  sessionKey: customKey,
}: ChatWidgetProps) {
  const SESSION_KEY = customKey || "faraday_chat_v1";
  const SESSION_TTL = 24 * 60 * 60 * 1000;

  const initialMessages: Message[] = [{ role: "assistant", content: INTRO_MESSAGE }];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [leadData, setLeadData] = useState<LeadData>({});
  const [complete, setComplete] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [currentChips, setCurrentChips] = useState<string[]>(INTRO_CHIPS);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoSaveRef = useRef(false);

  // Refs for sendBeacon on unload (avoids stale closure)
  const leadDataRef = useRef(leadData);
  const savedRef = useRef(saved);
  const messagesRef = useRef(messages);
  useEffect(() => { leadDataRef.current = leadData; }, [leadData]);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const score = scoreLead(leadData);
  const { grade, label, color, bar } = gradeInfo(score);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.timestamp && Date.now() - data.timestamp < SESSION_TTL && data.messages?.length > 1) {
          setMessages(data.messages);
          setLeadData(data.leadData || {});
          setCurrentChips([]);
          if (data.saved) {
            setComplete(true);
            setSaved(true);
          } else {
            setComplete(data.complete || false);
          }
        } else if (!data.timestamp || Date.now() - data.timestamp >= SESSION_TTL) {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {}
    setHydrated(true);
  }, [SESSION_KEY]);

  // Persist to localStorage on changes
  useEffect(() => {
    if (!hydrated) return;
    if (messages.length <= 1) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        messages,
        leadData,
        complete,
        saved,
        timestamp: Date.now(),
      }));
    } catch {}
  }, [messages, leadData, complete, saved, hydrated, SESSION_KEY]);

  // Partial-lead save on page unload — captures phone even if they leave mid-chat
  useEffect(() => {
    function onUnload() {
      const ld = leadDataRef.current;
      if (!ld.phone || savedRef.current) return;
      const conversation = messagesRef.current
        .map((m) => `${m.role === "assistant" ? "Anna" : "User"}: ${m.content}`)
        .join("\n");
      const blob = new Blob(
        [JSON.stringify({ ...ld, conversation, source, partial: true })],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/leads", blob);
    }
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [source]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, currentChips]);

  const saveLead = useCallback(async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const conversation = messages
        .map((m) => `${m.role === "assistant" ? "Anna" : "User"}: ${m.content}`)
        .join("\n");

      const utm = getUtm();
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...leadData,
          conversation,
          source: utmToSource(utm) || source,
          source_detail: utmToSourceDetail(utm),
        }),
      });
      setSaved(true);
      try { localStorage.removeItem(SESSION_KEY); } catch {}
    } catch {
      setSaving(false);
      autoSaveRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [messages, leadData, source, saving, saved, SESSION_KEY]);

  // Auto-save when Anna marks conversation complete
  useEffect(() => {
    if (complete && !saved && !saving && !autoSaveRef.current) {
      autoSaveRef.current = true;
      saveLead();
    }
  }, [complete, saved, saving, saveLead]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    setCurrentChips([]);
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (!overrideText) setInput("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = { messages: newMessages };
      if (prefillService) body.prefillService = prefillService;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const anna: AnnaResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: anna.message },
      ]);

      if (anna.data && Object.keys(anna.data).length > 0) {
        setLeadData((prev) => {
          const merged: LeadData = { ...prev };
          for (const [k, v] of Object.entries(anna.data)) {
            if (v !== null && v !== undefined) {
              (merged as Record<string, unknown>)[k] = v;
            }
          }
          return merged;
        });
      }

      if (anna.complete) setComplete(true);
      if (anna.chips && anna.chips.length > 0) setCurrentChips(anna.chips);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, quick tech hiccup! Can you try again?",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, prefillService]);

  return (
    <div className={`flex gap-4 ${compact ? "h-[500px]" : "h-[600px]"}`}>
      {/* Chat Panel */}
      <div className="flex flex-col flex-1 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold text-sm">
              A
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-gray-900" />
          </div>
          <div>
            <p className="font-semibold text-sm text-white">Anna</p>
            <p className="text-xs text-gray-400">Faraday Construction • Online</p>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-amber-500/10 border border-amber-500/20 text-gray-100"
                    : "bg-gray-700 text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-amber-400" />
                </div>
              </div>
            </div>
          )}

          {/* Quick-reply chips */}
          {currentChips.length > 0 && !loading && !saved && (
            <div className="flex flex-wrap gap-2 pt-1">
              {currentChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="bg-gray-800 hover:bg-amber-500/20 border border-gray-700 hover:border-amber-500/50 rounded-full px-3 py-1.5 text-xs text-gray-300 hover:text-amber-300 transition-all duration-150 active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Auto-save status */}
          {complete && !saved && (
            <div className="flex justify-center mt-2">
              <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-400">
                <svg className="w-4 h-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Saving your info...
              </div>
            </div>
          )}

          {saved && (
            <div className="bg-emerald-900/40 border border-emerald-700/50 rounded-xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-emerald-300 font-semibold text-sm">You&apos;re all set!</span>
              </div>
              <p className="text-gray-400 text-xs">A Faraday specialist will reach out within the hour.</p>
              {leadData.phone && (
                <p className="text-gray-500 text-xs mt-1">Watch for a text to {leadData.phone}.</p>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
              disabled={loading || saved}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim() || saved}
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Lead Intelligence Panel — internal use only, never shown on public page */}
      {showIntelPanel && (
        <div className="hidden lg:flex flex-col w-56 gap-3">
          {/* Score */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Lead Score</p>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-3xl font-black ${color}`}>{score}</span>
              <span className="text-gray-500 text-sm mb-1">/100</span>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${color} bg-gray-800`}>
                {grade} · {label}
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${bar} transition-all duration-500 rounded-full`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Extracted Data */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex-1">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Captured Info</p>
            <div className="space-y-2 text-xs">
              {leadData.name && <DataRow label="Name" value={leadData.name} />}
              {leadData.phone && <DataRow label="Phone" value={leadData.phone} />}
              {leadData.email && <DataRow label="Email" value={leadData.email} truncate />}
              {(leadData.city || leadData.zip) && (
                <DataRow label="Location" value={`${leadData.city || ""} ${leadData.zip || ""}`.trim()} />
              )}
              {leadData.service && (
                <DataRow label="Service" value={SERVICE_LABELS[leadData.service] || leadData.service} accent />
              )}
              {leadData.urgency && (
                <DataRow
                  label="Urgency"
                  value={URGENCY_LABELS[leadData.urgency] || leadData.urgency}
                  accent={leadData.urgency === "emergency"}
                />
              )}
              {leadData.homeowner !== null && leadData.homeowner !== undefined && (
                <DataRow label="Homeowner" value={leadData.homeowner ? "Yes" : "No"} />
              )}
              {leadData.damage_visible !== null && leadData.damage_visible !== undefined && (
                <DataRow label="Damage" value={leadData.damage_visible ? "Visible" : "None seen"} />
              )}
              {leadData.insurance_filed && (
                <DataRow
                  label="Insurance"
                  value={
                    leadData.insurance_filed === "true"
                      ? "Filed"
                      : leadData.insurance_filed === "planning_to"
                      ? "Planning to"
                      : "No"
                  }
                />
              )}
              {leadData.roof_age && (
                <DataRow label="Roof age" value={`${leadData.roof_age} yrs`} />
              )}
              {!leadData.name && !leadData.service && (
                <p className="text-gray-600 italic">Collecting info...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DataRow({
  label,
  value,
  accent = false,
  truncate = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span
        className={`font-medium text-right ${accent ? "text-amber-400" : "text-gray-200"} ${truncate ? "truncate max-w-[100px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
