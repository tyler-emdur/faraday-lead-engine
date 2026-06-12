import { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://faradaysun.com";

  // Static pages
  const routes: MetadataRoute.Sitemap = [
    {
      url: site,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${site}/chat`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${site}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Dynamic blog posts
  try {
    const db = getSupabase();
    const { data: posts } = await db
      .from("blog_posts")
      .select("slug, published_at, created_at")
      .eq("published", true)
      .order("published_at", { ascending: false });

    if (posts) {
      for (const post of posts) {
        routes.push({
          url: `${site}/blog/${post.slug}`,
          lastModified: new Date(post.published_at || post.created_at),
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB unavailable — return static routes only
  }

  return routes;
}
