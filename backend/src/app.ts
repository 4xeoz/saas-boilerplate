import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v01Router, v1Router, rootRouter } from "./routes";
import { err } from "./lib/response-helpers";
import { appConfig } from "./config/config";

export function createApp() {
  const app = express();

  // Security headers (HSTS, X-Frame-Options, no-sniff, etc). This is a JSON
  // API, so the default Content-Security-Policy — which is aimed at HTML — is
  // switched off rather than left to block nothing meaningful.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(
    cors({
      origin: appConfig.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  // Unversioned: "/" and health checks.
  app.use("/", rootRouter);

  // The current API.
  app.use("/v1", v1Router);

  // Replacement Cloud Receiver protocol. Pairing is intentionally the only
  // v0.1 surface enabled in the first increment.
  app.use("/v0.1", v01Router);

  // Nothing matched above, so the route does not exist.
  app.use(function handleNotFound(_req: Request, res: Response) {
    res.status(404).json(err("NOT_FOUND", "Route not found"));
  });

  // Everything asyncHandler catches arrives here through next(error), as does
  // any synchronous throw from a route.
  //
  // The four-argument signature is load-bearing: Express identifies error
  // handlers by counting arguments (fn.length === 4). Removing the unused
  // _next would silently turn this into ordinary middleware that never runs.
  app.use(function handleError(
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) {
    console.error("[unhandled]", error);
    res.status(500).json(err("INTERNAL_ERROR", "Something went wrong"));
  });

  return app;
}
