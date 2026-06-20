// Resend email helper for lead follow-ups and team notifications
import { Resend } from "resend";

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
  html: string
): Promise<boolean> {
  try {
    const from = (process.env.FROM_EMAIL || "leads@faradayconstruction.com").trim();

    await getClient().emails.send({
      from: `Faraday Construction <${from}>`,
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
