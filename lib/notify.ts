// Tyler's unified notification layer
// Sends via SMS (Twilio) if configured, email (Resend) if configured, or both.
// System works at full capacity with Resend alone — Twilio is optional.

import { sendEmail } from "@/lib/resend";

async function trySendSMS(phone: string, message: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return false; // Twilio not configured — skip silently
  }
  try {
    const { sendSMS } = await import("@/lib/twilio");
    return sendSMS(phone, message);
  } catch {
    return false;
  }
}

function messageToHtml(message: string): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;">
    <div style="background:#1a1a1a;padding:16px 20px;border-radius:10px 10px 0 0;">
      <p style="color:#f59e0b;font-weight:900;font-size:16px;margin:0;">FARADAY LEAD ENGINE</p>
    </div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:20px;">
      <pre style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace;font-size:14px;line-height:1.8;white-space:pre-wrap;margin:0;color:#111827;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
    </div>
  </div>`;
}

// Notify Tyler via all available channels
export async function notifyTyler(
  message: string,
  subject?: string
): Promise<void> {
  const tylerPhone = process.env.TYLER_PHONE || process.env.TEAM_PHONE;
  const tylerEmail = process.env.TYLER_EMAIL || process.env.TEAM_EMAIL;

  // Derive subject from first line of message if not provided
  const emailSubject =
    subject ||
    message
      .split("\n")[0]
      .replace(/[⚡🔥✅📋⚠️→]/g, "")
      .trim() ||
    "Faraday Lead Alert";

  const tasks: Promise<unknown>[] = [];

  if (tylerPhone) {
    tasks.push(trySendSMS(tylerPhone, message).catch(() => {}));
  }

  // Email always runs when Resend is available — this is the primary channel without Twilio
  if (tylerEmail) {
    tasks.push(
      sendEmail(tylerEmail, emailSubject, messageToHtml(message)).catch(e =>
        console.error("Tyler email notification failed:", e)
      )
    );
  }

  await Promise.all(tasks);
}

// Send a confirmation to a lead (email only — no Twilio required)
export async function confirmLead(lead: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  service?: string | null;
}): Promise<void> {
  // SMS confirmation if Twilio available
  if (lead.phone && process.env.TWILIO_ACCOUNT_SID) {
    try {
      const { sendSMS } = await import("@/lib/twilio");
      const { leadConfirmationSms } = await import("@/lib/templates");
      await sendSMS(
        lead.phone,
        leadConfirmationSms({
          name: lead.name ?? undefined,
          service: lead.service ?? undefined,
        })
      ).catch(() => {});
    } catch {}
  }

  // Email confirmation — works without Twilio
  if (lead.email) {
    try {
      const { sendEmail: send } = await import("@/lib/resend");
      const { welcomeEmail } = await import("@/lib/templates");
      const tpl = welcomeEmail({
        name: lead.name || "",
        service: lead.service ?? undefined,
        phone: lead.phone ?? undefined,
        email: lead.email ?? undefined,
      });
      await send(lead.email, tpl.subject, tpl.html).catch(() => {});
    } catch {}
  }
}
