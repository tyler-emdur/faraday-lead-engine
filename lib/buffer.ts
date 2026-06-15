// Buffer social media scheduler
// Queues before/after job photos for Facebook, Instagram, and TikTok.
//
// Required env vars:
//   BUFFER_ACCESS_TOKEN   — buffer.com → Settings → API → Access Token
//   BUFFER_PROFILE_IDS    — comma-separated profile IDs (FB,IG,TikTok)
//                           Get from: GET https://api.bufferapp.com/1/profiles.json
//
// Usage:
//   import { queuePost } from "@/lib/buffer";
//   await queuePost({ text: "...", imageUrl: "https://..." });

const BUFFER_API = "https://api.bufferapp.com/1";

interface BufferPost {
  text: string;
  imageUrl?: string;
  scheduledAt?: Date;
}

function getProfileIds(): string[] {
  const ids = process.env.BUFFER_PROFILE_IDS || "";
  return ids.split(",").map(s => s.trim()).filter(Boolean);
}

export async function queuePost(post: BufferPost): Promise<{ queued: number; failed: number }> {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  if (!token) {
    console.warn("BUFFER_ACCESS_TOKEN not set — skipping social queue");
    return { queued: 0, failed: 0 };
  }

  const profileIds = getProfileIds();
  if (!profileIds.length) {
    console.warn("BUFFER_PROFILE_IDS not set — skipping social queue");
    return { queued: 0, failed: 0 };
  }

  let queued = 0;
  let failed = 0;

  for (const profileId of profileIds) {
    try {
      const params = new URLSearchParams();
      params.append("text", post.text);
      params.append("profile_ids[]", profileId);
      params.append("access_token", token);
      if (post.imageUrl) params.append("media[photo]", post.imageUrl);
      if (post.scheduledAt) params.append("scheduled_at", post.scheduledAt.toISOString());

      const res = await fetch(`${BUFFER_API}/updates/create.json`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });

      if (res.ok) {
        queued++;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error(`Buffer queue failed for profile ${profileId}:`, err);
        failed++;
      }
    } catch (e) {
      console.error(`Buffer queue error for profile ${profileId}:`, e);
      failed++;
    }
  }

  return { queued, failed };
}

// Generate a storm-appropriate post for automatic social queueing
export function generateStormPost(city: string, hailNote: string): string {
  const posts = [
    `⛈ ${hailNote.toUpperCase()} just hit ${city}. If you're a homeowner, your roof damage may be FULLY covered by insurance. Faraday Construction is doing FREE inspections this week — we handle all the paperwork. Call (720) 766-1518 or DM us. #HailDamage #FreeInspection #${city.replace(/\s+/g, "")}CO`,
    `🏠 Attention ${city} homeowners: hail just confirmed in your area. Don't wait — insurance claim windows close fast after storms. Faraday does FREE roof inspections and handles your claim from start to finish. Most homeowners pay only their deductible. (720) 766-1518 #${city.replace(/\s+/g, "")} #HailDamage`,
    `Hail hit ${city} tonight. ⚡ If your car has dents, your roof does too — but you can't see it from the ground. Faraday Construction offers FREE inspections and works directly with your insurance adjuster. We've recovered $9K–$22K for hundreds of Colorado families. Link in bio or call (720) 766-1518.`,
  ];
  return posts[Math.floor(Math.random() * posts.length)];
}

// Generate a before/after job post
export function generateJobPost(city: string, serviceType: string, claimAmount?: number): string {
  const service = serviceType === "hail_damage" ? "hail damage" : serviceType === "roofing" ? "roof replacement" : serviceType;
  const amountNote = claimAmount ? ` Insurance covered $${claimAmount.toLocaleString()}.` : " Insurance covered the full repair.";

  return `Another ${service} job done in ${city}! 🏠✅${amountNote} Homeowner only paid their deductible. If your roof has hail damage, call Faraday for a FREE inspection — (720) 766-1518. We handle everything. #Faraday #${city.replace(/\s+/g, "")}CO #HailDamage #FreeInspection`;
}
