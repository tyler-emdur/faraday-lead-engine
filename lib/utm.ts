const UTM_KEY = "faraday_utm_v1";
const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];

export interface UtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
}

export function captureUtm(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const data: UtmData = {};
    let found = false;
    for (const key of UTM_PARAMS) {
      const val = params.get(key);
      if (val) {
        (data as Record<string, string>)[key] = val;
        found = true;
      }
    }
    if (found) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(data));
    }
  } catch {}
}

export function getUtm(): UtmData {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(UTM_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function utmToSourceDetail(utm: UtmData): string | undefined {
  if (utm.utm_campaign) return utm.utm_campaign;
  if (utm.fbclid) return "facebook_ad";
  if (utm.gclid) return "google_ad";
  if (utm.utm_source) return utm.utm_source;
  return undefined;
}

export function utmToSource(utm: UtmData): string | undefined {
  if (utm.gclid || utm.utm_source === "google") return "google";
  if (utm.fbclid || utm.utm_source === "facebook") return "facebook";
  if (utm.utm_medium === "social") return "social";
  if (utm.utm_medium === "email") return "email";
  return undefined;
}
