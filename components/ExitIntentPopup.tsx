"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getUtm, utmToSource, utmToSourceDetail } from "@/lib/utm";

const DISMISSED_KEY = "faraday_exit_dismissed";

export default function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const firedRef = useRef(false);

  const dismiss = useCallback(() => {
    setShow(false);
    try { sessionStorage.setItem(DISMISSED_KEY, "1"); } catch {}
  }, []);

  const triggerPopup = useCallback(() => {
    if (firedRef.current) return;
    try {
      if (sessionStorage.getItem(DISMISSED_KEY)) return;
      // Don't show if Anna already captured this lead
      const chat = localStorage.getItem("faraday_chat_v1");
      if (chat) {
        const parsed = JSON.parse(chat);
        if (parsed.saved || parsed.complete) return;
      }
    } catch {}
    firedRef.current = true;
    setShow(true);
  }, []);

  useEffect(() => {
    // Exit intent: mouse leaves top of viewport
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 10 && e.relatedTarget === null) {
        triggerPopup();
      }
    };

    // Time-based: 60 seconds on page with no interaction
    const timer = setTimeout(triggerPopup, 60000);

    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      clearTimeout(timer);
    };
  }, [triggerPopup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setSubmitting(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || undefined,
          service: "hail_damage",
          urgency: "immediate",
          source: utmToSource(getUtm()) || "exit_intent",
          source_detail: utmToSourceDetail(getUtm()),
        }),
      });
    } catch {}
    setDone(true);
    setSubmitting(false);
    setTimeout(dismiss, 3000);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-amber-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Got it!</h3>
            <p className="text-gray-400 text-sm">A specialist will reach out within the hour.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 bg-red-900/40 border border-red-800/50 text-red-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Wait — before you go
              </div>
              <h3 className="text-white font-black text-xl mb-2 leading-tight">
                Your roof damage might already be paid for.
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Most Colorado homeowners don&apos;t realize their hail damage is fully covered by insurance.
                A free inspection takes 30 minutes and costs you nothing.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="First name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60"
              />
              <button
                type="submit"
                disabled={!phone || submitting}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Get My Free Inspection →"}
              </button>
            </form>

            <p className="text-gray-600 text-xs text-center mt-3">
              No commitment. No spam. Just a free inspection.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
