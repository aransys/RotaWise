// Email delivery via SMTP (Nodemailer). When SMTP isn't configured, emails are
// logged to the console instead of sent — so local dev never breaks and no
// provider is required to try the app. All sends are best-effort: a failure
// here never throws into the calling request.

const FROM = process.env.SMTP_FROM ?? "RotaWise <no-reply@rotawise.local>";

export function appUrl(path = ""): string {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

interface EmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailInput): Promise<void> {
  if (!smtpConfigured()) {
    console.log(`[email:dev] would send to ${to} — "${subject}" (set SMTP_* env vars to deliver for real)`);
    return;
  }
  try {
    // @ts-ignore optional dependency — installed via `npm install`, imported only when SMTP is configured
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transport.sendMail({
      from: FROM,
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    });
  } catch (e) {
    console.error("[email] send failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
    <div style="font-weight:700;font-size:18px;color:#4f46e5;margin-bottom:16px">RotaWise</div>
    <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
    <div style="font-size:14px;line-height:1.6;color:#334155">${bodyHtml}</div>
    ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${cta.label}</a>
    <div style="font-size:12px;color:#94a3b8;margin-top:14px">Or paste this link into your browser:<br><span style="word-break:break-all">${cta.url}</span></div>` : ""}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <div style="font-size:12px;color:#94a3b8">You're receiving this because you have a RotaWise account.</div>
  </div>`;
}

export function inviteEmailHtml(companyName: string, link: string): string {
  return layout(
    `Join ${companyName} on RotaWise`,
    `You've been invited to access the staff scheduling workspace for <strong>${companyName}</strong>. Set a password to activate your login — the link expires in 7 days.`,
    { label: "Activate my login", url: link }
  );
}

export function notificationEmailHtml(title: string, body?: string | null, link?: string | null): string {
  return layout(
    title,
    body ?? "You have a new update in RotaWise.",
    link ? { label: "Open RotaWise", url: appUrl(link) } : undefined
  );
}
