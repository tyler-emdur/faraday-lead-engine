"use client";

import { useState } from "react";
import ChatWidget from "./ChatWidget";

export default function ChatSection() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black font-black text-sm">A</div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-gray-950" />
          </div>
          <div className="text-left">
            <p className="text-white font-semibold text-sm">Anna · Faraday Construction</p>
            <p className="text-emerald-400 text-xs">Online now — typically replies instantly</p>
          </div>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-bold px-7 py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-amber-900/30"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
          </svg>
          Start Chat with Anna
        </button>
        <p className="text-gray-600 text-xs">No cost · No commitment · Get answers in seconds</p>
      </div>
    );
  }

  return <ChatWidget source="website" />;
}
