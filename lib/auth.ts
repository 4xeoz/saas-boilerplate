import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/prisma/prisma";
import { authConfig } from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function locked(identifier: string) {
  const record = await prisma.loginAttempt.findUnique({ where: { identifier } });
  if (!record?.lockedUntil) return false;
  if (record.lockedUntil > new Date()) return true;
  await prisma.loginAttempt.update({ where: { identifier }, data: { attempts: 0, lockedUntil: null } });
  return false;
}

async function failed(identifier: string) {
  const record = await prisma.loginAttempt.upsert({
    where: { identifier },
    create: { identifier, attempts: 1 },
    update: { attempts: { increment: 1 } },
  });
  if (record.attempts >= MAX_ATTEMPTS) {
    await prisma.loginAttempt.update({
      where: { identifier },
      data: { lockedUntil: new Date(Date.now() + LOCKOUT_MS) },
    });
  }
}

async function clear(identifier: string) {
  await prisma.loginAttempt.deleteMany({ where: { identifier } });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success || (await locked(parsed.data.email))) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
        });
        if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
          await failed(parsed.data.email);
          return null;
        }

        await clear(parsed.data.email);
        const membership = user.memberships[0];
        if (!membership) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: membership.role,
          organizationId: membership.organizationId,
        };
      },
    }),
  ],
});

export { AuthError };
