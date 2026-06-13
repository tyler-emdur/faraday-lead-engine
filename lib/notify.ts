// Tyler's unified notification layer
// Channels: ntfy (push), email (Resend), SMS (Twilio — optional).

import { sendEmail } from "@/lib/resend";

async function tryNtfy(message: string, title?: string): Promise<boolean> {
  const token = process.env.NTFY_TOKEN;
  const topic = (process.env.NTFY_TOPIC || "faraday-leads").trim();
  if (!token) return false;
  try {
    const res = await fetch(`https://ntfy.sh/${topic}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Title: title || "Faraday Lead Alert",
        Priority: "high",
        Tags: "bell",
        "Content-Type": "text/plain",
      },
      body: message,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function trySendSMS(phone: string, message: string): Promise<boolean> {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return false;
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

  // ntfy push notification — instant, free, no carrier registration
  tasks.push(tryNtfy(message, subject).catch(() => {}));

  if (tylerPhone) {
    tasks.push(trySendSMS(tylerPhone, message).catch(() => {}));
  }

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
