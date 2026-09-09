import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/sign-in" },
  callbacks: {
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;
      if (pathname.startsWith("/app")) return Boolean(auth?.user);
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = String(token.id);
      if (token.role) session.user.role = String(token.role);
      if (token.organizationId) session.user.organizationId = String(token.organizationId);
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
