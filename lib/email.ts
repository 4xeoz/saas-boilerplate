import { Resend } from "resend";
import { prisma } from "@/prisma/prisma";

type EmailInput = { userId?: string; organizationId?: string; email: string; name?: string; subject: string; html: string; template: string };

async function sendEmail(input: EmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    await prisma.emailLog.create({ data: { organizationId: input.organizationId, recipient: input.email, template: input.template, status: "skipped_not_configured" } }).catch(() => undefined);
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({ from, to: input.email, subject: input.subject, html: input.html });
    const providerId = result.data?.id;
    await prisma.emailLog.create({ data: { organizationId: input.organizationId, recipient: input.email, template: input.template, providerId, status: result.error ? "failed" : "sent", errorMessage: result.error?.message } });
    return { sent: !result.error, providerId };
  } catch (error) {
    await prisma.emailLog.create({ data: { organizationId: input.organizationId, recipient: input.email, template: input.template, status: "failed", errorMessage: error instanceof Error ? error.message : "email_failed" } }).catch(() => undefined);
    return { sent: false, reason: "provider_error" };
  }
}

export function sendWelcomeEmail(input: { userId: string; organizationId: string; email: string; name: string }) {
  return sendEmail({ ...input, template: "welcome", subject: "Welcome to Northstar", html: `<h1>Welcome, ${escapeHtml(input.name)}</h1><p>Your workspace is ready. Sign in to start your first project.</p>` });
}

export function sendInviteEmail(input: { organizationId: string; email: string; token: string; workspaceName: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${baseUrl}/register?invite=${encodeURIComponent(input.token)}`;
  return sendEmail({ ...input, template: "workspace-invite", subject: `Join ${input.workspaceName}`, html: `<h1>You are invited to ${escapeHtml(input.workspaceName)}</h1><p><a href="${inviteUrl}">Accept your invitation</a></p>` });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}
