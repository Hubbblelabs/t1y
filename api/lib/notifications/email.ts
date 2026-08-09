import "server-only";

import { Resend } from "resend";

import { env, isEmailConfigured, isProduction } from "@/lib/env";
import { logger } from "@/lib/utils/logger";

/**
 * Transactional email.
 *
 * These messages are account-lifecycle only (verification, password reset,
 * staff invitations). Health information is never sent by email.
 *
 * When `RESEND_API_KEY` is absent the message is logged instead of sent, so
 * local development works without an email provider. That fallback is refused
 * in production.
 */

let client: Resend | null = null;

function resend(): Resend {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(message: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) {
    if (isProduction()) {
      // Failing loudly beats silently dropping a password-reset email.
      throw new Error("RESEND_API_KEY is not configured; cannot send email.");
    }
    logger.info("email.skipped", {
      to: message.to,
      subject: message.subject,
      reason: "RESEND_API_KEY not configured",
    });
    return;
  }

  const { error } = await resend().emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    logger.error("email.failed", { subject: message.subject, reason: error.message });
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1d21;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e7ea;border-radius:8px;">
      <tr>
        <td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:18px;font-weight:600;">${heading}</h1>
          ${bodyHtml}
          <p style="margin:32px 0 0;font-size:12px;line-height:18px;color:#6b7280;border-top:1px solid #e4e7ea;padding-top:16px;">
            If you did not expect this email you can safely ignore it.
            This message was sent by the Digital Diabetes Management Platform.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:500;">${label}</a>
  </p>
  <p style="margin:0;font-size:13px;line-height:20px;color:#6b7280;">
    If the button does not work, copy this link into your browser:<br />
    <span style="word-break:break-all;">${url}</span>
  </p>`;
}

export async function sendVerificationEmail(params: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Verify your email address",
    html: layout(
      "Verify your email address",
      `<p style="margin:0;font-size:14px;line-height:22px;">Hello ${escapeHtml(params.name)},</p>
       <p style="margin:12px 0 0;font-size:14px;line-height:22px;">Confirm this address to finish setting up your account.</p>
       ${button(params.url, "Verify email address")}`,
    ),
    text: `Hello ${params.name},\n\nConfirm your email address to finish setting up your account:\n${params.url}\n\nIf you did not expect this email you can ignore it.`,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  url: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      `<p style="margin:0;font-size:14px;line-height:22px;">Hello ${escapeHtml(params.name)},</p>
       <p style="margin:12px 0 0;font-size:14px;line-height:22px;">Use the link below to choose a new password. It expires in one hour.</p>
       ${button(params.url, "Reset password")}`,
    ),
    text: `Hello ${params.name},\n\nUse this link to choose a new password (expires in one hour):\n${params.url}\n\nIf you did not request a reset you can ignore this email.`,
  });
}

export async function sendStaffInviteEmail(params: {
  to: string;
  name: string;
  roleLabel: string;
  url: string;
}): Promise<void> {
  await send({
    to: params.to,
    subject: "You have been invited to the administration dashboard",
    html: layout(
      "Dashboard invitation",
      `<p style="margin:0;font-size:14px;line-height:22px;">Hello ${escapeHtml(params.name)},</p>
       <p style="margin:12px 0 0;font-size:14px;line-height:22px;">An account has been created for you with the role <strong>${escapeHtml(params.roleLabel)}</strong>. Set a password to activate it.</p>
       ${button(params.url, "Set your password")}`,
    ),
    text: `Hello ${params.name},\n\nAn account has been created for you with the role ${params.roleLabel}. Set a password to activate it:\n${params.url}`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
