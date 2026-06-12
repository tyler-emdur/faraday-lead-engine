import ChatWidget from "@/components/ChatWidget";

export const metadata = {
  title: "Chat with Anna — Faraday Construction",
  description:
    "Chat with Anna, our 24/7 AI specialist, to get answers about roofing, hail damage, windows, and solar — and schedule your free inspection.",
};

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <span className="text-amber-500 text-lg font-black tracking-tight group-hover:text-amber-400 transition-colors">
              FARADAY
            </span>
            <span className="text-gray-400 text-sm hidden sm:block">Construction</span>
          </a>
          <div className="text-xs text-gray-500 hidden sm:block">
            Free Inspections · Licensed & Insured in Colorado
          </div>
        </div>
      </header>

      {/* Chat */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">
            Chat with <span className="text-amber-500">Anna</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Available 24/7 to answer your questions and get you a free inspection scheduled.
          </p>
        </div>
        <div className="flex-1">
          <ChatWidget source="chat_page" />
        </div>
      </div>

      <footer className="border-t border-gray-800/60 py-4">
        <p className="text-center text-xs text-gray-600">
          Faraday Construction — Colorado's Trusted Roofing, Solar &amp; Windows Experts
        </p>
      </footer>
    </main>
  );
}
