import { Router } from "express";
import { profileHandler, googleAuthCallbackHandler, logoutHandler } from "./auth.controller";
import { jwtAuthGuard } from "./passport";
import passport from "passport";
import { logRequest } from "../../middleware/logger";

export const authRouter = Router();

authRouter.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
authRouter.get("/google/callback", passport.authenticate("google", { session: false }), googleAuthCallbackHandler);
authRouter.get("/me", logRequest(), jwtAuthGuard(), profileHandler);
authRouter.post("/logout", logoutHandler());
