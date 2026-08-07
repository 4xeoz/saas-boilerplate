import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { appConfig } from "../../config/config";
import type { PublicUser } from "../../types/user.types";
import { userService } from "../users/public";
import { ok, err } from "../../lib/response-helpers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { refreshToken } from "../../db/schema";
import { authService } from "./auth.service";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Shared cookie options, used for BOTH setting and clearing. clearCookie only
 * removes a cookie when domain and path match exactly, so these must never
 * drift apart.
 *
 * domain matters in production: the API runs on api.example.com while
 * the frontend runs on example.com. Without an explicit parent domain
 * the cookie is host-only and Next's middleware can never see it.
 */
function cookieBase() {
  return {
    httpOnly: true,
    secure: appConfig.isProduction,
    path: "/",
    sameSite: "lax" as const,
    ...(appConfig.cookieDomain ? { domain: appConfig.cookieDomain } : {}),
  };
}

async function issueTokens(res: Response, user: PublicUser) {
  // Note: no `role` in the payload. The JWT strategy re-reads the user from
  // the database on every request, so a copy here would only ever be a stale
  // duplicate of req.user.role — and a tempting one to trust by mistake.
  const accessToken = jwt.sign(
    { sub: user.id, username: user.name },
    appConfig.jwtSecret,
    { expiresIn: appConfig.jwtExpiresIn }
  );

  const rawRefresh = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + appConfig.refreshTokenTtlMs);

  await db.insert(refreshToken).values({
    userId: user.id,
    tokenHash: hashToken(rawRefresh),
    expiresAt,
  });

  res.cookie("token", accessToken, { ...cookieBase(), maxAge: appConfig.accessTokenTtlMs });
  res.cookie("refresh_token", rawRefresh, { ...cookieBase(), maxAge: appConfig.refreshTokenTtlMs });
}

export async function googleAuthCallbackHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.redirect(`${appConfig.frontendUrl}/login?error=auth_failed`);
  }

  const user = req.user as PublicUser;
  await issueTokens(res, user);

  return res.redirect(`${appConfig.frontendUrl}/dashboard`);
}

export async function refreshHandler(req: Request, res: Response) {
  const rawRefresh = req.cookies?.refresh_token;
  if (!rawRefresh) return res.status(401).json(err("MISSING_TOKEN", "No refresh token."));

  const record = await db.query.refreshToken.findFirst({
    where: eq(refreshToken.tokenHash, hashToken(rawRefresh)),
    with: { user: true },
  });

  if (!record) {
    return res.status(401).json(err("INVALID_TOKEN", "Refresh token invalid or expired."));
  }

  // A revoked token being presented means a copy of it escaped: rotation
  // already retired this one when it was legitimately used. Treat it as theft
  // and revoke the user's whole family, which logs out the attacker and the
  // real user together. The real user just signs in with Google again.
  if (record.revokedAt) {
    const revokedCount = await authService.revokeAllForUser(record.userId);
    console.warn(
      `[auth] refresh token reuse detected for user ${record.userId}; revoked ${revokedCount} token(s)`
    );
    res.clearCookie("token", cookieBase());
    res.clearCookie("refresh_token", cookieBase());
    return res
      .status(401)
      .json(err("TOKEN_REUSE", "Session revoked for security. Please sign in again."));
  }

  if (record.expiresAt < new Date()) {
    return res.status(401).json(err("INVALID_TOKEN", "Refresh token invalid or expired."));
  }

  const user = userService.toPublic(record.user);

  await db
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(refreshToken.id, record.id));

  await issueTokens(res, user);

  return res.json(ok(null, "Token refreshed."));
}

export async function profileHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
  }

  const userId = (req.user as PublicUser).id;
  const user = await userService.findById(userId);

  if (!user) {
    return res.status(404).json(err("NOT_FOUND", "User not found."));
  }

  return res.json(ok(userService.toPublic(user), "User profile fetched successfully."));
}

export async function logoutHandler(req: Request, res: Response) {
  const rawRefresh = req.cookies?.refresh_token;
  if (rawRefresh) {
    await db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshToken.tokenHash, hashToken(rawRefresh)),
          isNull(refreshToken.revokedAt)
        )
      );
  }

  res.clearCookie("token", cookieBase());
  res.clearCookie("refresh_token", cookieBase());
  return res.json(ok(null, "Logged out successfully."));
}
