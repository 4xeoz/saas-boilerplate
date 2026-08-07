import { Router, Request, Response, NextFunction } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { healthRouter } from "../modules/system-health/health.routes";
import { userRouter } from "../modules/users/user.routes";

/**
 * Version 1 of the API. Everything a client calls lives under /v1.
 *
 * A version prefix means a future breaking change (renaming a field, changing
 * a status code) can ship as /v2 while /v1 keeps serving older clients.
 */
export const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", userRouter);

/**
 * Unversioned infrastructure routes.
 *
 * Health checks are deliberately NOT versioned: they are consumed by Docker,
 * load balancers, and uptime monitors, which should not have to be
 * reconfigured when the API version changes.
 */
export const rootRouter = Router();

rootRouter.get("/", (_req: Request, res: Response) => {
  res.send("Backend is running. Visit /health");
});

rootRouter.use("/health", healthRouter);

/**
 * Marks a response as coming from the deprecated unversioned paths, so old
 * clients are visible in logs and monitoring before the routes are removed.
 */
export function markDeprecated(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Deprecation", "true");
  res.setHeader("Warning", '299 - "Unversioned API paths are deprecated, use /v1"');
  next();
}
