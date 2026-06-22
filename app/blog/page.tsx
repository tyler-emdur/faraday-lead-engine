import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import QuickCaptureForm from "@/components/QuickCaptureForm";

export const revalidate = 3600;

export const metadata = {
  title: "Colorado Roofing, Solar & Hail Damage Blog | Faraday Construction",
  description:
    "Expert articles on hail damage, roof replacement, solar installation, and replacement windows for Colorado Front Range homeowners.",
};

export default async function BlogIndexPage() {
  // Guard so a missing Supabase env at build time can't fail the whole deploy
  // (prerender of /blog was crashing builds with "supabaseUrl is required").
  let posts: { id: string; title: string; slug: string; meta_description: string | null; target_keyword: string | null; target_city: string | null; published_at: string | null; created_at: string }[] | null = [];
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = getSupabase();
      ({ data: posts } = await db
        .from("blog_posts")
        .select("id, title, slug, meta_description, target_keyword, target_city, published_at, created_at")
        .eq("published", true)
        .order("published_at", { ascending: false })
        .limit(50));
    } catch {
      posts = [];
    }
  }

  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-black tracking-tight">FARADAY</span>
            <span className="text-gray-400 text-sm hidden sm:block">Construction</span>
          </Link>
          <a
            href={`tel:${phone}`}
            className="text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors"
          >
            {phone}
          </a>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-wider mb-2">
            Colorado Home Experts
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-3">
            Roofing, Solar &amp; Storm Guide
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Expert advice for Colorado Front Range homeowners on hail damage, roof replacement,
            solar savings, and energy efficiency.
          </p>
        </div>

        {(!posts || posts.length === 0) ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">Our first articles publish automatically every Monday.</p>
            <Link
              href="/#chat"
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-xl text-sm transition-colors inline-block"
            >
              Chat with Anna for advice now →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block bg-gray-900 border border-gray-800 hover:border-amber-500/30 rounded-2xl p-5 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {post.target_city && (
                      <p className="text-amber-500/70 text-xs font-semibold uppercase tracking-wider mb-1.5">
                        {post.target_city}, Colorado
                      </p>
                    )}
                    <h2 className="text-white font-bold text-lg group-hover:text-amber-400 transition-colors mb-2 leading-snug">
                      {post.title}
                    </h2>
                    {post.meta_description && (
                      <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
                        {post.meta_description}
                      </p>
                    )}
                  </div>
                  <span className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">→</span>
                </div>
                <p className="text-gray-600 text-xs mt-3">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                    : new Date(post.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  {" · "}Faraday Construction
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* CTA — inline form, no navigation away */}
        <div className="mt-12 bg-gray-900 border border-amber-500/25 rounded-2xl p-6 md:p-7">
          <div className="text-center mb-5">
            <h2 className="text-2xl font-black text-white mb-2">
              Ready for a Free Inspection?
            </h2>
            <p className="text-gray-400 text-sm">
              No pressure, no obligation. 30 seconds. We call or text within the hour.
            </p>
          </div>
          <QuickCaptureForm source="blog_index" />
          <p className="text-gray-600 text-xs text-center mt-4">
            Prefer to call? <a href={`tel:${phone}`} className="text-amber-400 hover:text-amber-300 font-semibold transition-colors">{phone}</a>
          </p>
        </div>
      </div>

      <footer className="border-t border-gray-800/60 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-gray-600">
          <p>© {new Date().getFullYear()} Faraday Construction · Boulder, CO · Licensed &amp; Insured</p>
          <Link href="/" className="text-amber-500/60 hover:text-amber-400 transition-colors mt-2 inline-block">
            ← Back to Homepage
          </Link>
        </div>
      </footer>
    </div>
  );
}
