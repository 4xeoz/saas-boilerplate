import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  if ((pathname === "/sign-in" || pathname === "/register") && request.auth?.user) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/app/:path*", "/sign-in", "/register"] };
