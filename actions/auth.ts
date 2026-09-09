"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/prisma/prisma";
import { signIn, signOut } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(12).max(200),
});

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "workspace";
}

export async function login(formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) return { success: false, error: "Invalid email or password." };
    return { success: false, error: "Unable to sign in right now." };
  }
}

export async function register(formData: FormData) {
  const parsed = registrationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { success: false, error: "Use a name, valid email, and password of at least 12 characters." };

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: "An account with that email already exists." };

  const password = await bcrypt.hash(parsed.data.password, 12);
  const baseSlug = slugify(parsed.data.name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: parsed.data.name, email: parsed.data.email, password } });
    const organization = await tx.organization.create({ data: { name: `${parsed.data.name}'s workspace`, slug } });
    await tx.organizationMember.create({ data: { userId: user.id, organizationId: organization.id, role: "OWNER" } });
    await tx.subscription.create({ data: { organizationId: organization.id, plan: "FREE", status: "ACTIVE" } });
    return { user, organization };
  });

  await sendWelcomeEmail({ userId: result.user.id, organizationId: result.organization.id, email: result.user.email, name: result.user.name || "there" });
  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
  } catch {
    return { success: true, requiresLogin: true };
  }
  return { success: true, requiresLogin: false };
}

export async function logout() {
  await signOut({ redirect: false });
}
