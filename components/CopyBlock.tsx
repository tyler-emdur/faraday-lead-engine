"use client";

import { useState } from "react";

export default function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide">{label}</span>
        <button
          onClick={handleCopy}
          className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${
            copied
              ? "bg-green-900/60 text-green-300"
              : "bg-gray-700 hover:bg-gray-600 text-gray-300"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="text-gray-300 text-xs whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
    </div>
  );
}
