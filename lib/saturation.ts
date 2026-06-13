// Neighborhood Saturation Engine
// After a storm, scores each affected city so Tyler knows where to focus first.
// Inputs: which cities got hit, how big the hail was.
// Output: ranked list with score + reasoning.

import { getSupabase } from "@/lib/supabase";

export interface NeighborhoodScore {
  city: string;
  score: number;
  priority: "high" | "medium" | "low";
  hail_size_inches: number;
  past_leads: number;
  won_jobs: number;
  reasoning: string;
}

// City → home age bonus. Older homes = higher roof failure risk.
function homeAgeBonus(city: string): number {
  const c = city.toLowerCase();
  if (["aurora", "denver", "lakewood", "arvada", "westminster", "englewood"].some(k => c.includes(k))) return 15;
  if (["boulder", "fort collins", "longmont", "loveland", "greeley"].some(k => c.includes(k))) return 12;
  if (["broomfield", "thornton", "northglenn", "wheat ridge"].some(k => c.includes(k))) return 10;
  if (["erie", "brighton", "centennial", "littleton"].some(k => c.includes(k))) return 8;
  if (["parker", "castle rock", "highlands ranch", "lone tree"].some(k => c.includes(k))) return 6;
  return 8;
}

export async function scoreNeighborhoods(
  affectedCities: string[],
  hailSizeInches: number
): Promise<NeighborhoodScore[]> {
  let leads: { city: string | null }[] = [];
  let jobs: { address: string | null }[] = [];

  if (process.env.SUPABASE_URL && affectedCities.length > 0) {
    const db = getSupabase();
    const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString();

    const [leadsRes, jobsRes] = await Promise.all([
      db.from("leads").select("city").in("city", affectedCities).gte("created_at", twoYearsAgo),
      db.from("jobs").select("address").eq("status", "complete").limit(500),
    ]);
    leads = leadsRes.data || [];
    jobs = jobsRes.data || [];
  }

  return affectedCities
    .map(city => {
      const cityLeads = leads.filter(l =>
        l.city && city.toLowerCase().split(" ").some(w => l.city!.toLowerCase().includes(w))
      );
      const cityJobs = jobs.filter(j =>
        j.address && city.toLowerCase().split(" ").some(w => j.address!.toLowerCase().includes(w))
      );

      let score = 0;

      // Hail severity (0–40)
      if (hailSizeInches >= 2.0) score += 40;
      else if (hailSizeInches >= 1.5) score += 32;
      else if (hailSizeInches >= 1.0) score += 24;
      else if (hailSizeInches >= 0.75) score += 16;
      else score += 8;

      // Historical leads: each = +5, cap at 25
      score += Math.min(cityLeads.length * 5, 25);

      // Won jobs: each = +10, cap at 20
      score += Math.min(cityJobs.length * 10, 20);

      // Home age factor (0–15)
      score += homeAgeBonus(city);

      score = Math.min(100, score);
      const priority: "high" | "medium" | "low" = score >= 65 ? "high" : score >= 40 ? "medium" : "low";

      const parts = [
        `${hailSizeInches}" hail`,
        cityLeads.length > 0 ? `${cityLeads.length} past leads` : null,
        cityJobs.length > 0 ? `${cityJobs.length} closed jobs` : null,
      ].filter(Boolean);

      return {
        city,
        score,
        priority,
        hail_size_inches: hailSizeInches,
        past_leads: cityLeads.length,
        won_jobs: cityJobs.length,
        reasoning: parts.join(" · "),
      };
    })
    .sort((a, b) => b.score - a.score);
}
