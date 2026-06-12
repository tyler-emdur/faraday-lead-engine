import { notFound } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getSupabase();
  const { data: post } = await db
    .from("blog_posts")
    .select("title, meta_description, target_city, published_at")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!post) return { title: "Not Found" };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";
  const description = post.meta_description || `Expert ${post.target_city || "Colorado"} roofing and home improvement advice from Faraday Construction.`;

  return {
    title: `${post.title} | Faraday Construction`,
    description,
    openGraph: {
      title: post.title,
      description,
      type: "article",
      publishedTime: post.published_at,
      url: `${site}/blog/${slug}`,
      siteName: "Faraday Construction",
    },
    twitter: {
      card: "summary",
      title: post.title,
      description,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getSupabase();

  const { data: post } = await db
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!post) return notFound();

  const phone = process.env.NEXT_PUBLIC_COMPANY_PHONE || "(720) 766-1518";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";
  const paragraphs = (post.content as string).split("\n\n").filter(Boolean);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.meta_description,
    "datePublished": post.published_at || post.created_at,
    "dateModified": post.published_at || post.created_at,
    "author": {
      "@type": "Organization",
      "name": "Faraday Construction",
      "url": site,
    },
    "publisher": {
      "@type": "Organization",
      "name": "Faraday Construction",
      "logo": {
        "@type": "ImageObject",
        "url": `${site}/favicon.ico`,
      },
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${site}/blog/${slug}`,
    },
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <nav className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-amber-500 text-xl font-black tracking-tight">FARADAY</span>
            <span className="text-gray-400 text-sm hidden sm:block">Construction</span>
          </Link>
          <a href={`tel:${phone}`} className="text-amber-400 hover:text-amber-300 font-semibold text-sm transition-colors">
            {phone}
          </a>
        </div>
      </nav>

      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <p className="text-gray-500 text-xs mb-6">
          <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
          <span className="mx-2">›</span>
          <Link href="/blog" className="hover:text-gray-400 transition-colors">Blog</Link>
          <span className="mx-2">›</span>
          <span className="text-gray-400">{post.target_city || "Colorado"}</span>
        </p>

        {post.target_city && (
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-wider mb-3">
            {post.target_city}, Colorado
          </p>
        )}
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          {post.title}
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          {post.published_at
            ? new Date(post.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : new Date(post.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          {" · "}Faraday Construction
        </p>

        <div className="prose prose-invert prose-amber max-w-none">
          {paragraphs.map((para, i) => (
            <p key={i} className="text-gray-300 leading-relaxed mb-5 text-lg">
              {para}
            </p>
          ))}
        </div>

        {/* Inline CTA mid-article (after 4th paragraph) */}
        {paragraphs.length > 4 && (
          <div className="my-8 bg-gray-900 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-white font-semibold text-sm">Get a free inspection — no commitment</p>
              <p className="text-gray-400 text-xs mt-0.5">Most repairs are fully covered by insurance.</p>
            </div>
            <Link
              href="/#chat"
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap"
            >
              Chat with Anna →
            </Link>
          </div>
        )}

        {/* Main CTA */}
        <div className="mt-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-black text-white mb-2">Ready for a Free Inspection?</h2>
          <p className="text-gray-400 mb-6 text-sm">
            No pressure, no obligation. A Faraday specialist will assess your home and give you a detailed written estimate.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/#chat"
              className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Chat With Anna Now
            </Link>
            <a
              href={`tel:${phone}`}
              className="border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Call {phone}
            </a>
          </div>
        </div>

        {/* Related articles prompt */}
        <div className="mt-8 text-center">
          <Link href="/blog" className="text-amber-500/60 hover:text-amber-400 transition-colors text-sm">
            ← More articles from Faraday Construction
          </Link>
        </div>
      </article>

      <footer className="border-t border-gray-800/60 mt-8">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Faraday Construction · Boulder, CO · Licensed &amp; Insured</p>
        </div>
      </footer>
    </div>
  );
}
