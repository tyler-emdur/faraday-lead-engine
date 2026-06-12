"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ChatWidget from "./ChatWidget";

const FLOAT_DISMISS_KEY = "faraday_float_dismissed_v1";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const pulseTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Don't re-pulse if they've already engaged this session
    try {
      if (sessionStorage.getItem(FLOAT_DISMISS_KEY)) {
        setDismissed(true);
        return;
      }
    } catch {}

    // Pulse the button after 12 seconds to draw attention
    pulseTimerRef.current = setTimeout(() => {
      setPulse(true);
      // Stop pulsing after 5 seconds if they don't click
      setTimeout(() => setPulse(false), 5000);
    }, 12000);

    return () => clearTimeout(pulseTimerRef.current);
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setPulse(false);
    clearTimeout(pulseTimerRef.current);
    try { sessionStorage.setItem(FLOAT_DISMISS_KEY, "1"); } catch {}
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  // Hidden on mobile — mobile uses sticky CTA bar instead
  return (
    <div className="hidden sm:flex fixed bottom-6 right-6 z-50 flex-col items-end gap-3">
      {/* Chat popup */}
      {open && (
        <div
          className="bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden flex flex-col"
          style={{ width: 380, height: "min(540px, calc(100vh - 100px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-xs">
                A
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-gray-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">Anna</p>
              <p className="text-gray-400 text-xs mt-0.5">Faraday Construction · Online now</p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Chat — uses separate session key so it doesn't conflict with inline chat */}
          <div className="flex-1 overflow-hidden">
            <ChatWidget compact source="floating_chat" sessionKey="faraday_float_v1" />
          </div>
        </div>
      )}

      {/* Trigger button */}
      {!open && (
        <div className="flex flex-col items-end gap-2">
          {/* Preview bubble that appears when pulsing */}
          {pulse && !dismissed && (
            <div className="bg-gray-900 border border-gray-700 rounded-2xl rounded-br-sm px-4 py-3 shadow-xl max-w-[220px]">
              <p className="text-gray-200 text-sm font-medium leading-snug">
                Got a roofing question? I can help in seconds.
              </p>
              <p className="text-amber-400 text-xs mt-1.5 font-medium">Anna · Faraday Construction</p>
            </div>
          )}

          <button
            onClick={handleOpen}
            className={`
              relative w-14 h-14 bg-amber-500 hover:bg-amber-400
              rounded-full flex items-center justify-center
              shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50
              transition-all duration-200 active:scale-95
              ${pulse && !dismissed ? "animate-bounce" : ""}
            `}
            aria-label="Chat with Anna"
          >
            {/* Chat icon */}
            <svg className="w-6 h-6 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>

            {/* Unread badge when pulsing */}
            {pulse && !dismissed && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold border-2 border-white animate-pulse">
                1
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
