// Lead scoring algorithm for Faraday Construction
// Weights optimized for roofing/solar/windows in Colorado

export interface LeadData {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  zip?: string | null;
  city?: string | null;
  service?: string | null;
  homeowner?: boolean | null;
  roof_age?: number | null;
  damage_visible?: boolean | null;
  damage_description?: string | null;
  insurance_filed?: string | null;
  urgency?: string | null;
  electric_bill?: string | null;
  notes?: string | null;
}

export function scoreLead(d: LeadData): number {
  let s = 0;

  // Service type — hail/multiple highest because insurance pays
  if (d.service === "multiple") s += 35;
  else if (d.service === "hail_damage") s += 30;
  else if (d.service === "roofing") s += 22;
  else if (d.service === "solar") s += 20;
  else if (d.service === "windows") s += 18;

  // Homeowner (must own to authorize work)
  if (d.homeowner === true) s += 12;

  // Damage indicators
  if (d.damage_visible === true) s += 12;

  // Damage description quality — detailed descriptions = more committed lead
  if (d.damage_description) {
    const desc = d.damage_description.toLowerCase();
    const strongIndicators = ["leak", "missing", "broken", "collapsed", "flooding", "interior"];
    const goodIndicators = ["dent", "granule", "crack", "shingle", "gutter", "vent", "skylight"];
    const hasStrong = strongIndicators.some((w) => desc.includes(w));
    const goodCount = goodIndicators.filter((w) => desc.includes(w)).length;
    if (hasStrong) s += 8;
    else if (goodCount >= 2) s += 5;
    else if (goodCount >= 1) s += 3;
    else if (desc.length > 30) s += 2; // detailed description even without keywords
  }

  // Insurance (filed or planning = ready to move fast)
  if (d.insurance_filed === "planning_to") s += 10;
  else if (d.insurance_filed === "true") s += 8;

  // Roof age — older roof with damage = higher urgency + bigger claim
  if (d.roof_age !== null && d.roof_age !== undefined) {
    if (d.roof_age >= 20) s += 8;
    else if (d.roof_age >= 15) s += 6;
    else if (d.roof_age >= 10) s += 4;
    else if (d.roof_age >= 5) s += 2;
    // New roof under 5 years doesn't add much
  }

  // Urgency
  if (d.urgency === "emergency") s += 25;
  else if (d.urgency === "immediate") s += 18;
  else if (d.urgency === "this_month") s += 10;
  else if (d.urgency === "exploring") s += 3;

  // Contact completeness — phone is king for conversion
  if (d.phone) s += 6;
  if (d.email) s += 3;
  if (d.zip || d.city) s += 3;

  // Both phone + email = very engaged lead
  if (d.phone && d.email) s += 4;

  return Math.min(s, 100);
}

export function gradeLead(score: number): { grade: string; label: string } {
  if (score >= 75) return { grade: "A", label: "HOT" };
  if (score >= 55) return { grade: "B", label: "WARM" };
  if (score >= 35) return { grade: "C", label: "COOL" };
  return { grade: "D", label: "COLD" };
}

// Estimated pipeline value per lead grade (avg CO project sizes)
export function estimatePipelineValue(grade: string, service?: string | null): number {
  const base: Record<string, number> = {
    A: 18000,
    B: 9000,
    C: 3500,
    D: 800,
  };
  const multiplier: Record<string, number> = {
    hail_damage: 1.0,
    roofing: 1.1,
    solar: 1.8,
    windows: 0.7,
    multiple: 1.5,
  };
  const b = base[grade] ?? 1000;
  const m = multiplier[service ?? ""] ?? 1.0;
  return Math.round(b * m);
}
