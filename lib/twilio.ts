// Twilio SMS helper for lead follow-ups and team alerts
import twilio from "twilio";

let client: twilio.Twilio | null = null;

function getClient() {
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return client;
}

export async function sendSMS(to: string, body: string): Promise<boolean> {
  try {
    // Clean phone number
    let phone = to.replace(/[^\d+]/g, "");
    if (!phone.startsWith("+1") && !phone.startsWith("+")) {
      phone = "+1" + phone;
    }

    await getClient().messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });

    console.log(`SMS sent to ${phone}`);
    return true;
  } catch (error) {
    console.error("Twilio SMS error:", error);
    return false;
  }
}

// Send team alert about new lead
export async function alertTeam(message: string): Promise<boolean> {
  const teamPhone = process.env.TEAM_PHONE;
  if (!teamPhone) {
    console.warn("TEAM_PHONE not set, skipping SMS alert");
    return false;
  }
  return sendSMS(teamPhone, message);
}

// Tyler's personal lead notification — formatted for forwarding to Faraday
export async function notifyTyler(lead: {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  service?: string | null;
  grade?: string | null;
  score?: number | null;
  source?: string | null;
  urgency?: string | null;
}): Promise<boolean> {
  const tylerPhone = process.env.TYLER_PHONE || process.env.TEAM_PHONE;
  if (!tylerPhone) {
    console.warn("TYLER_PHONE not set, skipping Tyler notification");
    return false;
  }

  const serviceLabel: Record<string, string> = {
    hail_damage: "Hail Damage",
    roofing: "Roofing",
    solar: "Solar",
    windows: "Windows",
    multiple: "Multiple Services",
  };

  const urgencyFlag = lead.urgency === "emergency" ? " ⚠️ EMERGENCY" : "";
  const gradeEmoji = lead.grade === "A" ? "🔥" : lead.grade === "B" ? "✅" : "📋";

  const msg = [
    `${gradeEmoji} NEW LEAD — $100 opportunity${urgencyFlag}`,
    `${lead.name || "Unknown"} | ${lead.phone || "no phone"}`,
    `${lead.city || "Unknown city"} | ${serviceLabel[lead.service || ""] || lead.service || "Unknown service"}`,
    `Grade: ${lead.grade || "?"} (score: ${lead.score ?? "?"}) | via ${lead.source || "chat"}`,
    `→ Forward to Faraday now`,
  ].join("\n");

  return sendSMS(tylerPhone, msg);
}
