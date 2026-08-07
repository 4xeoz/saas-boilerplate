import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard", "/settings", "/notifications"];

export function middleware(req: NextRequest) {
  const isProtected = PROTECTED.some((path) => req.nextUrl.pathname.startsWith(path));
  if (!isProtected) return NextResponse.next();

  console.log("Middleware cookies:", req.cookies.getAll()); // add this

  const token = req.cookies.get("token")?.value;
  const refresh = req.cookies.get("refresh_token")?.value;
  if (!token && !refresh) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}


export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/notifications/:path*"],
};
