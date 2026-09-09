"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/prisma/prisma";
import { sendInviteEmail } from "@/lib/email";

async function currentContext() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) throw new Error("You must be signed in.");
  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId: session.user.organizationId } },
    include: { organization: true },
  });
  if (!membership) throw new Error("Workspace access is not available.");
  return { session, membership };
}

const projectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

export async function createProject(formData: FormData) {
  const parsed = projectSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) return { success: false, error: "Enter a project name." };
  try {
    const { session, membership } = await currentContext();
    const slug = `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.project.create({ data: { organizationId: membership.organizationId, createdById: session.user.id, name: parsed.data.name, slug, description: parsed.data.description || null } });
    revalidatePath("/app/projects");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create the project." };
  }
}

export async function updateWorkspace(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (name.length < 2 || name.length > 80) return { success: false, error: "Workspace name must be 2–80 characters." };
  try {
    const { membership } = await currentContext();
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") return { success: false, error: "Only workspace admins can change settings." };
    await prisma.organization.update({ where: { id: membership.organizationId }, data: { name } });
    revalidatePath("/app/settings");
    revalidatePath("/app", "layout");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update settings." };
  }
}

export async function inviteMember(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  if (!z.string().email().safeParse(email).success) return { success: false, error: "Enter a valid email." };
  try {
    const { membership } = await currentContext();
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") return { success: false, error: "Only workspace admins can invite members." };
    const invitation = await prisma.invitation.create({ data: { organizationId: membership.organizationId, email, role, token: randomUUID(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } });
    await sendInviteEmail({ organizationId: membership.organizationId, email, token: invitation.token, workspaceName: membership.organization.name });
    revalidatePath("/app/team");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not create the invitation." };
  }
}

export async function updateMemberRole(formData: FormData) {
  const memberId = String(formData.get("memberId") || "");
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  try {
    const { membership } = await currentContext();
    if (membership.role !== "OWNER") return { success: false, error: "Only the owner can change roles." };
    const target = await prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: membership.organizationId } });
    if (!target || target.id === membership.id) return { success: false, error: "That member cannot be changed." };
    await prisma.organizationMember.update({ where: { id: target.id }, data: { role } });
    revalidatePath("/app/team");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update the role." };
  }
}

export async function getDashboardData() {
  const { membership } = await currentContext();
  const [projects, assets, members, subscription] = await Promise.all([
    prisma.project.count({ where: { organizationId: membership.organizationId } }),
    prisma.asset.count({ where: { organizationId: membership.organizationId } }),
    prisma.organizationMember.count({ where: { organizationId: membership.organizationId } }),
    prisma.subscription.findUnique({ where: { organizationId: membership.organizationId } }),
  ]);
  const recentProjects = await prisma.project.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, name: true, status: true, updatedAt: true } });
  return { organization: membership.organization, role: membership.role, stats: { projects, assets, members, plan: subscription?.plan || "FREE" }, recentProjects };
}

export async function getWorkspaceSettings() {
  const { membership } = await currentContext();
  return { organization: membership.organization, role: membership.role };
}

export async function getTeamData() {
  const { membership } = await currentContext();
  const [members, invitations] = await Promise.all([
    prisma.organizationMember.findMany({ where: { organizationId: membership.organizationId }, include: { user: { select: { id: true, name: true, email: true, createdAt: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.invitation.findMany({ where: { organizationId: membership.organizationId, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return { role: membership.role, members, invitations };
}

export async function getProjects() {
  const { membership } = await currentContext();
  return prisma.project.findMany({ where: { organizationId: membership.organizationId }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { assets: true } } } });
}

export async function getAssets() {
  const { membership } = await currentContext();
  return prisma.asset.findMany({ where: { organizationId: membership.organizationId }, orderBy: { createdAt: "desc" }, take: 50, include: { project: { select: { name: true } } } });
}
