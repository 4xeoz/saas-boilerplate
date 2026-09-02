import { Router, Request, Response } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { pairingRouter } from "../modules/connectors/pairing.routes";
import { healthRouter } from "../modules/system-health/health.routes";

/**
 * Version 1 of the API. Everything a client calls lives under /v1.
 *
 * A version prefix means a future breaking change (renaming a field, changing
 * a status code) can ship as /v2 while /v1 keeps serving older clients.
 */
export const v1Router = Router();

v1Router.use("/auth", authRouter);

/**
 * Protocol v0.1 routes. Pairing is the first replacement-service increment;
 * later Consent and delivery modules must be added only after its gate passes.
 */
export const v01Router = Router();

v01Router.use(pairingRouter);

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
