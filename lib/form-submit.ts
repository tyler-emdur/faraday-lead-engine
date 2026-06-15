// Contact form auto-submitter — fetches a page, detects its contact form,
// and POSTs the message without a headless browser.
//
// Works for: plain HTML forms, WordPress Contact Form 7, Gravity Forms (non-AJAX)
// Falls back to "needs_manual" for JavaScript-only / reCAPTCHA forms.
//
// Optional: set BROWSERLESS_TOKEN to use browserless.io for JS-heavy sites.

export type SubmitResult =
  | { success: true; method: "html_post" | "cf7" | "browserless" }
  | { success: false; reason: "no_form" | "post_failed" | "js_only" | "captcha" | "error"; detail?: string };

interface FormField {
  name: string;
  type: string;
  value?: string;
}

// ── HTML parsing helpers ──────────────────────────────────────────────────────

function extractForms(html: string): { action: string; method: string; fields: FormField[] }[] {
  const forms: { action: string; method: string; fields: FormField[] }[] = [];
  const formRe = /<form([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;

  while ((fm = formRe.exec(html)) !== null) {
    const attrs = fm[1];
    const body = fm[2];

    const action = (attrs.match(/action=["']([^"']+)["']/i)?.[1] || "").trim();
    const method = (attrs.match(/method=["']([^"']+)["']/i)?.[1] || "post").toLowerCase();

    const fields: FormField[] = [];
    const inputRe = /<(?:input|textarea|select)([^>]*)>/gi;
    let inp: RegExpExecArray | null;
    while ((inp = inputRe.exec(body)) !== null) {
      const a = inp[1];
      const name = a.match(/name=["']([^"']+)["']/i)?.[1] || "";
      const type = a.match(/type=["']([^"']+)["']/i)?.[1] || "text";
      const value = a.match(/value=["']([^"']*?)["']/i)?.[1] || "";
      if (name) fields.push({ name, type, value });
    }
    // Textareas don't have value in opening tag
    const textareaRe = /<textarea([^>]*)>([\s\S]*?)<\/textarea>/gi;
    let ta: RegExpExecArray | null;
    while ((ta = textareaRe.exec(body)) !== null) {
      const name = ta[1].match(/name=["']([^"']+)["']/i)?.[1] || "";
      if (name && !fields.find(f => f.name === name)) {
        fields.push({ name, type: "textarea", value: "" });
      }
    }

    if (fields.length > 0) forms.push({ action, method, fields });
  }

  return forms;
}

function isContactForm(fields: FormField[]): boolean {
  const names = fields.map(f => f.name.toLowerCase());
  const hasMessage = names.some(n => n.includes("message") || n.includes("comment") || n.includes("msg") || n.includes("body") || n.includes("content"));
  const hasContact = names.some(n => n.includes("name") || n.includes("email") || n.includes("phone"));
  return hasMessage && hasContact;
}

function hasCaptcha(html: string): boolean {
  return /recaptcha|hcaptcha|g-recaptcha|turnstile/i.test(html);
}

function isJsOnly(html: string, forms: { action: string }[]): boolean {
  // If no forms found but there are obvious JS form references
  if (forms.length === 0 && /contact-form|wpcf7|nf-form|gform/i.test(html)) return true;
  // Wix / Squarespace sites
  if (/<meta[^>]+wix\.com|squarespace\.com/.test(html)) return true;
  return false;
}

// ── WordPress Contact Form 7 ──────────────────────────────────────────────────

function detectCF7(html: string): { formId: string; postId: string } | null {
  const match = html.match(/wpcf7-f(\d+)-p(\d+)/);
  if (!match) return null;
  return { formId: match[1], postId: match[2] };
}

async function submitCF7(
  pageUrl: string,
  html: string,
  message: string,
  senderName: string,
  senderEmail: string
): Promise<SubmitResult> {
  const cf7 = detectCF7(html);
  if (!cf7) return { success: false, reason: "no_form" };

  const origin = new URL(pageUrl).origin;
  const endpoint = `${origin}/wp-json/contact-form-7/v1/contact-forms/${cf7.formId}/feedback`;

  const body = new URLSearchParams({
    "_wpcf7": cf7.formId,
    "_wpcf7_version": "5.9",
    "_wpcf7_locale": "en_US",
    "_wpcf7_unit_tag": `wpcf7-f${cf7.formId}-p${cf7.postId}-o1`,
    "_wpcf7_container_post": cf7.postId,
    "your-name": senderName,
    "your-email": senderEmail,
    "your-message": message,
    // Common alternate field names
    "name": senderName,
    "email": senderEmail,
    "message": message,
  });

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": pageUrl,
        "Origin": origin,
        "User-Agent": "Mozilla/5.0 (compatible; FaradayBot/1.0)",
      },
      body: body.toString(),
    });

    const data = await res.json() as { status?: string };
    if (data?.status === "mail_sent") return { success: true, method: "cf7" };
    return { success: false, reason: "post_failed", detail: data?.status };
  } catch (e) {
    return { success: false, reason: "error", detail: String(e) };
  }
}

// ── Browserless.io fallback ──────────────────────────────────────────────────

async function submitViaBrowserless(
  websiteUrl: string,
  message: string,
  senderName: string,
  senderEmail: string
): Promise<SubmitResult> {
  const blessToken = (process.env.BROWSERLESS_TOKEN || "").trim();
  if (!blessToken) return { success: false, reason: "js_only", detail: "BROWSERLESS_TOKEN not set" };

  try {
    const script = `
      const page = await browser.newPage();
      await page.goto(${JSON.stringify(websiteUrl)}, { waitUntil: 'networkidle0', timeout: 20000 });
      // Find contact link if needed
      const contactLink = await page.$('a[href*="contact"]');
      if (contactLink) { await contactLink.click(); await page.waitForTimeout(2000); }
      // Fill name fields
      const nameField = await page.$('input[name*="name"], input[placeholder*="name" i]');
      if (nameField) await nameField.type(${JSON.stringify(senderName)});
      // Fill email
      const emailField = await page.$('input[type="email"], input[name*="email"]');
      if (emailField) await emailField.type(${JSON.stringify(senderEmail)});
      // Fill message
      const msgField = await page.$('textarea, input[name*="message"]');
      if (msgField) await msgField.type(${JSON.stringify(message)});
      // Submit
      const submit = await page.$('button[type="submit"], input[type="submit"]');
      if (submit) { await submit.click(); await page.waitForTimeout(3000); }
      return { ok: !!submit };
    `;

    const res = await fetch(`https://chrome.browserless.io/function?token=${blessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: script, context: {} }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) return { success: false, reason: "post_failed", detail: `browserless ${res.status}` };
    const data = await res.json() as { data?: { ok?: boolean } };
    if (data?.data?.ok) return { success: true, method: "browserless" };
    return { success: false, reason: "post_failed", detail: "form not found via browserless" };
  } catch (e) {
    return { success: false, reason: "error", detail: String(e) };
  }
}

// ── Generic HTML form POST ───────────────────────────────────────────────────

async function submitHtmlForm(
  pageUrl: string,
  form: { action: string; method: string; fields: FormField[] },
  message: string,
  senderName: string,
  senderEmail: string
): Promise<SubmitResult> {
  const origin = new URL(pageUrl).origin;
  let actionUrl = form.action;
  if (!actionUrl) actionUrl = pageUrl;
  else if (!actionUrl.startsWith("http")) {
    actionUrl = actionUrl.startsWith("/") ? `${origin}${actionUrl}` : `${pageUrl}/${actionUrl}`;
  }

  const body = new URLSearchParams();

  // Copy hidden fields and checkboxes with preset values
  for (const field of form.fields) {
    if (field.type === "hidden" || field.type === "checkbox" || field.type === "radio") {
      if (field.value) body.set(field.name, field.value);
    }
  }

  // Fill contact fields by name heuristic
  const nameField = form.fields.find(f =>
    /^(your[-_]?name|full[-_]?name|name|sender)$/i.test(f.name)
  );
  const emailField = form.fields.find(f => /email/i.test(f.name));
  const msgField = form.fields.find(f =>
    /message|comment|msg|body|content|inquiry/i.test(f.name) && f.type !== "hidden"
  );
  const phoneField = form.fields.find(f => /phone|tel/i.test(f.name));

  if (nameField) body.set(nameField.name, senderName);
  if (emailField) body.set(emailField.name, senderEmail);
  if (msgField) body.set(msgField.name, message);
  if (phoneField) body.set(phoneField.name, "(720) 766-1518");

  if (!msgField) return { success: false, reason: "no_form" };

  try {
    const res = await fetch(actionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": pageUrl,
        "Origin": origin,
        "User-Agent": "Mozilla/5.0 (compatible; FaradayBot/1.0)",
      },
      body: body.toString(),
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });

    // Most contact forms redirect on success or return 200
    if (res.ok || res.status === 302) return { success: true, method: "html_post" };
    return { success: false, reason: "post_failed", detail: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, reason: "error", detail: String(e) };
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function submitContactForm(
  websiteUrl: string,
  message: string,
  senderName: string = "Tyler Emdur",
  senderEmail: string = (process.env.FROM_EMAIL || "leads@faradayconstruction.com")
): Promise<SubmitResult> {
  let html: string;
  try {
    const res = await fetch(websiteUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FaradayBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { success: false, reason: "error", detail: `fetch ${res.status}` };
    html = await res.text();
  } catch (e) {
    return { success: false, reason: "error", detail: String(e) };
  }

  if (hasCaptcha(html)) {
    return { success: false, reason: "captcha" };
  }

  // Try CF7 first (most common CMS form plugin)
  if (detectCF7(html)) {
    const result = await submitCF7(websiteUrl, html, message, senderName, senderEmail);
    if (result.success) return result;
  }

  // Try generic HTML form
  const forms = extractForms(html);
  const contactForm = forms.find(f => isContactForm(f.fields));
  if (contactForm) {
    return submitHtmlForm(websiteUrl, contactForm, message, senderName, senderEmail);
  }

  // JavaScript-only form — try browserless if token set
  if (isJsOnly(html, forms)) {
    return submitViaBrowserless(websiteUrl, message, senderName, senderEmail);
  }

  // Look for a /contact page if on homepage
  if (!websiteUrl.includes("/contact")) {
    try {
      const contactUrl = websiteUrl.replace(/\/?$/, "/contact");
      return submitContactForm(contactUrl, message, senderName, senderEmail);
    } catch {
      // ignore
    }
  }

  return { success: false, reason: "no_form" };
}
