import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/dashboard") && !req.cookies.get("user_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/developer-dashboard") && !req.cookies.get("developer_session")) {
    return NextResponse.redirect(new URL("/developer-login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/developer-dashboard/:path*"],
};
