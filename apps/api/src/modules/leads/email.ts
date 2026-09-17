/**
 * THE EMAIL A VISITOR IS SENT, with the plan attached.
 *
 * Sent by the system, not by an employee: the moment a visitor opens a plan
 * in full, and again when they choose one. Plain SMTP through nodemailer,
 * so the broker's own mailbox provider does the sending and the address it
 * comes from is theirs.
 *
 * Every send RETURNS AN OUTCOME rather than throwing. The lead is recorded
 * whether or not the email went, and what the employee needs to know is
 * which — "PDF sent" or "PDF not sent" — not a stack trace in the page.
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

export interface EmailOutcome {
  status: 'SENT' | 'FAILED' | 'NOT_CONFIGURED';
  at: Date;
  error: string | null;
}

export interface PlanEmail {
  to: { name: string; address: string };
  subject: string;
  /** The opening line under the greeting. */
  intro: string;
  plan: { companyName: string; planName: string; premium: string };
  attachment: { filename: string; bytes: Uint8Array };
}

interface Sender {
  mailer: Transporter;
  from: string;
  replyTo: string | null;
}

let transporter: Transporter | null = null;
/** A transport handed in by a test, used in place of any SMTP settings. */
let override: Transporter | null = null;

/** The sender itself: the broker's fallback address when no `MAIL_FROM` is set. */
const FALLBACK_FROM = 'Hadbrok Insurance Brokers <info@hadbrok.com>';

function sender(): Sender | null {
  if (override) {
    return {
      mailer: override,
      from: env.mail?.from ?? FALLBACK_FROM,
      replyTo: env.mail?.replyTo ?? null,
    };
  }
  const mail = env.mail;
  if (!mail) return null;
  transporter ??= nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure,
    ...(mail.user ? { auth: { user: mail.user, pass: mail.password ?? '' } } : {}),
  });
  return { mailer: transporter, from: mail.from, replyTo: mail.replyTo };
}

export function isEmailConfigured(): boolean {
  return override !== null || env.mail !== null;
}

/** For tests: send through this instead of a real SMTP connection. `null` puts SMTP back. */
export function useEmailTransport(transport: Transporter | null): void {
  override = transport;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The message, in the house navy, readable in any client and as plain text. */
function render(email: PlanEmail): { text: string; html: string } {
  const plan = `${email.plan.companyName} · ${email.plan.planName}`;
  const lines = [
    `Dear ${email.to.name},`,
    '',
    email.intro,
    '',
    `Plan: ${plan}`,
    `Annual premium: ${email.plan.premium}`,
    '',
    'The full plan details are attached as a PDF.',
    'One of our team will contact you within 24 hours to take it from here.',
    '',
    'Hadbrok Insurance Brokers',
    '+20 12 2235 2235 · info@hadbrok.com',
  ];
  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f9;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2340">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3e6ef">
    <div style="background:#17244b;padding:22px 28px;color:#ffffff">
      <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.75">Hadbrok Insurance Brokers</div>
      <div style="font-size:20px;font-weight:700;margin-top:6px">${escapeHtml(email.subject)}</div>
    </div>
    <div style="padding:26px 28px;font-size:15px;line-height:1.6">
      <p style="margin:0 0 14px">Dear ${escapeHtml(email.to.name)},</p>
      <p style="margin:0 0 18px">${escapeHtml(email.intro)}</p>
      <div style="background:#eef1f8;border-radius:10px;padding:14px 18px;margin:0 0 18px">
        <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5c6380">Plan</div>
        <div style="font-size:17px;font-weight:700;color:#17244b;margin-top:2px">${escapeHtml(plan)}</div>
        <div style="font-size:14px;color:#3b4364;margin-top:4px">Annual premium: <strong>${escapeHtml(email.plan.premium)}</strong></div>
      </div>
      <p style="margin:0 0 10px">The full plan details are attached as a PDF.</p>
      <p style="margin:0 0 22px"><strong>One of our team will contact you within 24 hours</strong> to take it from here.</p>
      <p style="margin:0;color:#5c6380;font-size:13px">Hadbrok Insurance Brokers<br>+20 12 2235 2235 · info@hadbrok.com</p>
    </div>
  </div>
</body></html>`;
  return { text: lines.join('\n'), html };
}

/**
 * Send one plan to one visitor. Never throws: the outcome says what
 * happened, and the caller writes it on the lead.
 */
export async function sendPlanEmail(email: PlanEmail): Promise<EmailOutcome> {
  const at = new Date();
  const via = sender();
  if (!via) {
    if (!env.isProduction) {
      console.warn(
        `[mail] SMTP not configured; would have sent "${email.subject}" to ${email.to.address} with ${email.attachment.filename}`,
      );
    }
    return { status: 'NOT_CONFIGURED', at, error: null };
  }
  const { text, html } = render(email);
  try {
    await via.mailer.sendMail({
      from: via.from,
      ...(via.replyTo ? { replyTo: via.replyTo } : {}),
      to: { name: email.to.name, address: email.to.address },
      subject: email.subject,
      text,
      html,
      attachments: [
        {
          filename: email.attachment.filename,
          content: Buffer.from(email.attachment.bytes),
          contentType: 'application/pdf',
        },
      ],
    });
    return { status: 'SENT', at, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    console.error(`[mail] could not send "${email.subject}" to ${email.to.address}: ${error}`);
    return { status: 'FAILED', at, error: error.slice(0, 500) };
  }
}
