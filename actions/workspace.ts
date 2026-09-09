"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/prisma/prisma";

async function context() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) throw new Error("You must be signed in.");
  const membership = await prisma.organizationMember.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId: session.user.organizationId } }, include: { organization: true } });
  if (!membership) throw new Error("Workspace access is not available.");
  return membership;
}

export async function getWorkspaceSettings() {
  const membership = await context();
  return { organization: membership.organization, role: membership.role };
}

export async function updateWorkspace(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!z.string().min(2).max(80).safeParse(name).success) return { success: false, error: "Workspace name must be 2–80 characters." };
  try {
    const membership = await context();
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") return { success: false, error: "Only workspace admins can change settings." };
    await prisma.organization.update({ where: { id: membership.organizationId }, data: { name } });
    revalidatePath("/app/settings");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not update settings." };
  }
}
