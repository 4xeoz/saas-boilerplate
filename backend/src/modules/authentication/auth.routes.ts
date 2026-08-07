import { Router } from "express";
import { profileHandler, googleAuthCallbackHandler, refreshHandler, logoutHandler } from "./auth.controller";
import { jwtAuthGuard } from "./passport";
import passport from "passport";
import { logRequest } from "../../middleware/logger";
import { authRateLimiter } from "../../middleware/rateLimiter";
import { asyncHandler } from "../../lib/async-handler";

export const authRouter = Router();

authRouter.get("/google", authRateLimiter, passport.authenticate("google", { scope: ["profile", "email"] }));
authRouter.get("/google/callback", passport.authenticate("google", { session: false }), asyncHandler(googleAuthCallbackHandler));
authRouter.post("/refresh", authRateLimiter, asyncHandler(refreshHandler));
authRouter.get("/me", logRequest(), jwtAuthGuard(), asyncHandler(profileHandler));
authRouter.post("/logout", asyncHandler(logoutHandler));
