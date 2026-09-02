import { Router, Request, Response } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { pairingRouter } from "../modules/connectors/pairing.routes";
import { consentApiRouter, consentPageRouter } from "../modules/consent/consent.routes";
import { eventRouter } from "../modules/events/event.routes";
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
 * Protocol v0.1 routes. Features 1–4 add pairing, Consent/Target, signed Event
 * ingress, and target-scoped delivery claims. Acknowledgement and public Grant
 * routes remain absent until their separate decision gates.
 */
export const v01Router = Router();

v01Router.use(pairingRouter);
v01Router.use(consentApiRouter);
v01Router.use(eventRouter);
v01Router.use((_req: Request, res: Response) => {
  res.status(404).json({ error: { code: "http_route_not_found" } });
});

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
rootRouter.use(consentPageRouter);
