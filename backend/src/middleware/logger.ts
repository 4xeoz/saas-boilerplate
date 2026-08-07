// src/middleware/logRequest.ts

import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import passport from "passport";

// Defaults to OFF in production. This middleware prints the Cookie header,
// which contains the access and refresh tokens in plaintext — anyone with log
// access could lift a live session. Never enable it against real traffic.
export function logRequest(debug: boolean = process.env.NODE_ENV !== "production") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!debug) return next();

    console.log("─────────────── 📩 Incoming Request Debug ───────────────");
    console.log("➡️ Method:", req.method);
    console.log("➡️ URL:", req.originalUrl);

    // Headers, minus the ones that carry credentials.
    const { cookie, authorization, ...safeHeaders } = req.headers;
    console.log("🧩 Headers:", safeHeaders);
    console.log("🍪 Cookie:", cookie ? "(present, redacted)" : "none");

    // Authorization Header
    const auth = req.headers.authorization;
    console.log("🔑 Authorization:", auth ? "(present, redacted)" : "No Authorization header");

    // Try to decode the JWT payload
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);

      try {
        const decoded = jwt.decode(token);
        console.log("🧬 Decoded JWT Payload:", decoded || "Empty payload");
      } catch (err) {
        console.log("❌ Failed to decode JWT:", err);
      }
    }

    // Optional: log body (only if not large)
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("📦 Body:", req.body);
    }

    // check if the token is valid and log result
    passport.authenticate("jwt", { session: false }, (err: undefined, user: JwtPayload, info : undefined) => {
      if (err) {
        console.log("❌ JWT Authentication Error:", err);
      } else if (!user) {
        console.log("❌ JWT Authentication Failed:", info || "No user");
      } else {
        console.log("✅ JWT Authentication Succeeded for user:", user);
      }
    })(req, res, () => {});

    

    console.log("──────────────────────────────────────────────────────────\n");

    next();
  };
}
