// 52 target blog keywords — one per week, year-round rotation.
// Mix of storm-specific, seasonal, evergreen, local, informational.
// Tracked in Supabase: blog_keyword_position (integer) so we always pick the next one.

export const BLOG_KEYWORDS: string[] = [
  // Evergreen / insurance
  "does homeowners insurance cover hail damage colorado",
  "how to file a hail damage insurance claim colorado",
  "what to do after hail storm colorado",
  "how long after hail storm can you file insurance claim",
  "hail damage vs regular wear and tear roof",
  "how much does a new roof cost in colorado 2025",
  "can i choose my own roofer for insurance claim colorado",
  "how to spot hail damage on your roof",
  "colorado roofing insurance claim process explained",
  "what size hail causes roof damage",

  // Seasonal — spring/summer (storm season)
  "roof inspection checklist colorado spring 2025",
  "best time to replace roof colorado",
  "hail storm season colorado when does it start",
  "emergency roof repair colorado",
  "roof tarping after storm colorado",
  "what to expect during a roof replacement colorado",
  "hail damage roof repair denver 2025",
  "aurora hail storm roof damage 2025",
  "westminster hail damage free inspection 2025",
  "boulder county hail damage insurance claim",

  // Seasonal — fall/winter
  "roof inspection before winter colorado",
  "how to prevent ice dams colorado",
  "flat roof winter maintenance colorado",
  "snow load damage roof colorado",
  "roof repair before snow colorado",

  // Local
  "best roofing company denver colorado",
  "best roofing company boulder colorado",
  "best roofing company aurora colorado",
  "top rated roofing contractor front range colorado",
  "roofing company lakewood co",
  "roofing company westminster co",
  "roofing company thornton co",
  "roofing company fort collins co",
  "roofing company colorado springs",
  "roofing company arvada co",

  // Informational / educational
  "how long does roof replacement take",
  "metal roof vs shingle roof colorado",
  "class 4 impact resistant shingles colorado",
  "insurance discount impact resistant shingles colorado",
  "how to read a roofing estimate",
  "what is a public adjuster and do i need one",
  "roofing scams after hail storm colorado",
  "red flags when hiring a roofer colorado",
  "how to find a reputable roofer after a storm",
  "do i need a permit for roof replacement colorado",

  // Referral / B2B
  "how realtors can prevent deals from falling over roof issues",
  "same day roof certification for home sale colorado",
  "roof inspection for property managers colorado",
  "hoa roof inspection requirements colorado",
  "insurance agent guide to hail damage claims colorado",
  "mortgage lender roof certification requirements",
  "fsbo sellers guide to roof inspection colorado",
];

export function getKeywordForWeek(weekIndex: number): string {
  return BLOG_KEYWORDS[weekIndex % BLOG_KEYWORDS.length];
}
