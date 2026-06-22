// Resend email helper for lead follow-ups and team notifications
import { Resend } from "resend";
import { promises as dns } from "dns";

const mxCache = new Map<string, boolean>();

export async function hasMXRecord(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  if (mxCache.has(domain)) return mxCache.get(domain)!;
  try {
    const records = await dns.resolveMx(domain);
    if (!records.length) { mxCache.set(domain, false); return false; }
    // Verify the top-priority MX hostname itself resolves — catches broken MX records
    // (domain has MX entry but the mail server hostname doesn't exist)
    const topMX = records.sort((a, b) => a.priority - b.priority)[0].exchange;
    try { await dns.resolve(topMX); }
    catch { mxCache.set(domain, false); return false; }
    mxCache.set(domain, true);
    return true;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

// Domains that are known major providers — skip HTTP check, always valid
const KNOWN_REAL_DOMAINS = new Set([
  "remax.net","kw.com","compass.com","exprealty.com","boulderco.com",
  "thegroupinc.com","windermere.com","erashields.com","gmail.com","yahoo.com",
  "outlook.com","hotmail.com","kwparker.com","kwlongmont.com","kwcolorado.com",
]);

const domainPresenceCache = new Map<string, boolean>();

export async function hasDomainPresence(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  if (KNOWN_REAL_DOMAINS.has(domain)) return true;
  if (domainPresenceCache.has(domain)) return domainPresenceCache.get(domain)!;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch(`https://${domain}`, { method: "HEAD", signal: controller.signal, redirect: "follow" });
    clearTimeout(timer);
    domainPresenceCache.set(domain, true);
    return true;
  } catch {
    domainPresenceCache.set(domain, false);
    return false;
  }
}

const ROLE_PREFIXES = ["info@", "contact@", "admin@", "hello@", "support@", "office@", "mail@", "sales@", "general@", "team@"];

export function isRoleAddress(email: string): boolean {
  const lower = email.toLowerCase();
  return ROLE_PREFIXES.some(p => lower.startsWith(p));
}

let resendClient: Resend | null = null;

function getClient() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY!);
  }
  return resendClient;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  fromName?: string
): Promise<boolean> {
  try {
    const from = (process.env.FROM_EMAIL || "leads@faradayconstruction.com").trim();
    const displayName = fromName ?? "Faraday Construction";

    await getClient().emails.send({
      from: `${displayName} <${from}>`,
      to,
      subject,
      html,
    });

    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error("Resend email error:", error);
    return false;
  }
}

// Send team email notification about new lead
export async function emailTeam(
  subject: string,
  html: string
): Promise<boolean> {
  const teamEmail = process.env.TEAM_EMAIL;
  if (!teamEmail) {
    console.warn("TEAM_EMAIL not set, skipping email alert");
    return false;
  }
  return sendEmail(teamEmail, subject, html);
}
