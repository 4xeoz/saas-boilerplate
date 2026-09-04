import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { v01Router, v02Router, v1Router, rootRouter } from "./routes";
import { err } from "./lib/response-helpers";
import { appConfig } from "./config/config";
import {
  protocolResponsePolicy,
  protocolTransportGuard,
  standingProtocolResponsePolicy,
  standingProtocolTransportGuard,
  PROTOCOL_REQUEST_MAX_BYTES,
  isV01Path,
  isV02Path,
  isV02RequestTarget,
  standingJsonBodyDecoder,
} from "./middleware/protocol-transport";
import type { StandingRuntimeAdmissionAuthority } from "./modules/standing/standing.service";

export type AppOptions = Readonly<{
  /**
   * Server-side authority for the standing notification handoff route.
   *
   * The default is intentionally absent: a deployment must compose a real
   * runtime/Adapter authority explicitly before handoff can be accepted.
   */
  standingRuntimeAdmissionAuthority?: StandingRuntimeAdmissionAuthority;
}>;

function validateAppOptions(options: AppOptions): void {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("createApp options must be an object");
  }
  const authority = options.standingRuntimeAdmissionAuthority;
  if (
    authority !== undefined &&
    (!authority || typeof authority !== "object" || typeof authority.verifyAdmission !== "function")
  ) {
    throw new TypeError(
      "standingRuntimeAdmissionAuthority must implement verifyAdmission"
    );
  }
}

export function createApp(options: AppOptions = {}) {
  validateAppOptions(options);
  const app = express();

  // Keep the default serverless/local app fail-closed. Only an explicit
  // release composition may provide a real runtime-owned authority; the
  // Receiver never derives one from a token, process exit, or caller boolean.
  if (options.standingRuntimeAdmissionAuthority) {
    app.locals.standingRuntimeAdmissionAuthority =
      options.standingRuntimeAdmissionAuthority;
  }

  // Security headers (HSTS, X-Frame-Options, no-sniff, etc). This is a JSON
  // API, so the default Content-Security-Policy — which is aimed at HTML — is
  // switched off rather than left to block nothing meaningful.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Resolve the raw v0.2 request target before CORS can answer OPTIONS and
  // before Express can normalize case or discard query metadata.
  app.use(standingProtocolResponsePolicy);
  app.use(standingProtocolTransportGuard);
  const standingRawJsonParser = express.raw({
    inflate: false,
    limit: PROTOCOL_REQUEST_MAX_BYTES,
    type: () => true,
  });
  app.use((req, res, next) => {
    if (!isV02RequestTarget(req.originalUrl, req.path)) {
      next();
      return;
    }
    standingRawJsonParser(req, res, next);
  });
  app.use(standingJsonBodyDecoder);

  app.use(
    cors({
      origin: appConfig.frontendUrl,
      credentials: true,
    })
  );
  app.use(protocolResponsePolicy);
  app.use(protocolTransportGuard);
  app.use(express.json({ limit: PROTOCOL_REQUEST_MAX_BYTES, strict: true }));
  app.use(cookieParser());

  // Unversioned: "/" and health checks.
  app.use("/", rootRouter);

  // The current API.
  app.use("/v1", v1Router);

  // Replacement Cloud Receiver v2 protocol. Standing account inspection and
  // revocation are exposed only through the authenticated same-user controls
  // mounted below; v0.1 routes remain unchanged.
  app.use("/v0.1", v01Router);

  // Additive standing authorization kernel. It is selected only through the
  // exact v0.2 path; there is no negotiation or fallback to v0.1.
  app.use("/v0.2", v02Router);

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
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    if (isV02Path(req.path)) {
      const parserError = error as Error & {
        status?: number;
        statusCode?: number;
        type?: string;
      };
      if (
        parserError.type === "entity.too.large"
      ) {
        return res.status(413).json({
          error: { code: "http_body_too_large", retryable: false },
        });
      }
      if (
        parserError.type === "entity.parse.failed" ||
        parserError.type === "request.aborted" ||
        parserError.type === "request.size.invalid"
      ) {
        return res.status(400).json({
          error: { code: "http_body_invalid", retryable: false },
        });
      }
      const databaseErrorCode = (error as Error & { code?: unknown }).code;
      if (databaseErrorCode === "P2024" || databaseErrorCode === "P2034") {
        res.set("Retry-After", "1");
        return res.status(503).json({
          error: { code: "receiver_busy", retryable: true },
        });
      }
      if (res.headersSent) {
        return next(error);
      }
      console.error(JSON.stringify({
        event: "standing_receiver_error",
        route: req.path,
        status: 500,
        code: "receiver_internal_error",
      }));
      return res.status(500).json({
        error: { code: "receiver_internal_error", retryable: false },
      });
    }
    if (isV01Path(req.path)) {
      const parserError = error as Error & {
        status?: number;
        statusCode?: number;
        type?: string;
      };
      if (parserError.type === "entity.too.large" || parserError.status === 413 || parserError.statusCode === 413) {
        return res.status(413).json({ error: { code: "http_body_too_large" } });
      }
      if (parserError.type === "entity.parse.failed" || parserError.status === 400 || parserError.statusCode === 400) {
        return res.status(400).json({ error: { code: "http_body_invalid" } });
      }
      const databaseErrorCode = (error as Error & { code?: unknown }).code;
      if (databaseErrorCode === "P2024" || databaseErrorCode === "P2034") {
        res.set("Retry-After", "1");
        return res.status(503).json({ error: { code: "receiver_busy" } });
      }
      if (res.headersSent) {
        return next(error);
      }
      console.error(JSON.stringify({
        event: "receiver_error",
        route: req.path,
        status: 500,
        code: "receiver_internal_error",
      }));
      return res.status(500).json({ error: { code: "receiver_internal_error" } });
    }
    console.error("[unhandled]", error);
    res.status(500).json(err("INTERNAL_ERROR", "Something went wrong"));
  });

  return app;
}
