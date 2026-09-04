import type { NextFunction, Request, Response } from "express";
import { TextDecoder } from "node:util";
import { canonicalJson as canonicalV01Json } from "../modules/consent/manifest";
import { canonicalJson as canonicalV02Json } from "../modules/standing/standing.protocol";

export const PROTOCOL_REQUEST_MAX_BYTES = 16 * 1_024;
export const PROTOCOL_RESPONSE_MAX_BYTES = 32 * 1_024;

const v01ProtocolRoutes = new Set([
  "/v0.1/events",
  "/v0.1/connectors/disconnect",
  "/v0.1/delivery-claims",
  "/v0.1/delivery-acknowledgements",
]);

const v02PostProtocolRoutes = new Set([
  "/v0.2/events",
  "/v0.2/delivery-claims",
  "/v0.2/delivery-acknowledgements",
  "/v0.2/delivery-notification-handoffs",
  "/v0.2/host-keys",
  "/v0.2/consent-sessions",
  "/v0.2/account-consent-decisions",
]);

const v02GetProtocolRoutes = new Set([
  "/v0.2/consent-sessions",
  "/v0.2/grants",
]);

const v02ProtocolRoutes = new Set([
  ...v02PostProtocolRoutes,
  ...v02GetProtocolRoutes,
]);

const v02DynamicRoutePatterns = [
  /^\/v0\.2\/consent-sessions\/[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/,
  /^\/v0\.2\/grants\/[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/,
  /^\/v0\.2\/grants\/[A-Za-z0-9][A-Za-z0-9._:-]{0,159}\/revoke$/,
];

function standingRouteMethod(target: string): "POST" | "GET" | null {
  if (v02PostProtocolRoutes.has(target)) return "POST";
  if (v02GetProtocolRoutes.has(target)) return "GET";
  if (v02DynamicRoutePatterns[0].test(target) || v02DynamicRoutePatterns[1].test(target)) {
    return "GET";
  }
  if (v02DynamicRoutePatterns[2].test(target)) return "POST";
  return null;
}

const STANDING_RESPONSE_POLICY_APPLIED = "__webmcpStandingResponsePolicyApplied";
const STANDING_TRANSPORT_GUARD_APPLIED = "__webmcpStandingTransportGuardApplied";

export function isV01Path(path: string): boolean {
  return path === "/v0.1" || path.startsWith("/v0.1/");
}

export function isV02Path(path: string): boolean {
  return path === "/v0.2" || path.startsWith("/v0.2/");
}

/**
 * Express route matching is case-insensitive by default and `req.path` drops
 * the query string.  The v0.2 transport contract instead resolves the raw
 * request target exactly.  Recognise namespace-shaped aliases here so they
 * can be rejected by the standing boundary before CORS or JSON parsing.
 * Express also routes absolute-form URLs by their parsed path. Use that path
 * only to select rejection policy; acceptance still requires the raw target
 * to match the origin-form allowlist exactly.
 */
export function isV02RequestTarget(target: string, parsedPath: string): boolean {
  const namespace = /^\/v0\.2(?:\/|\?|#|$)/i;
  return namespace.test(target) || namespace.test(parsedPath);
}

function sendTransportError(
  res: Response,
  statusCode: number,
  code: string,
  standing: boolean
): void {
  res.status(statusCode).json({
    error: {
      code,
      ...(standing ? { retryable: false } : {}),
    },
  });
}

function isJsonContentType(value: string | undefined): boolean {
  return /^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(value?.trim() ?? "");
}

function distinctHeaderValues(req: Request, name: string): string[] {
  const lowerName = name.toLowerCase();
  const incoming = req as Request & {
    headersDistinct?: Record<string, string[] | undefined>;
  };
  const distinct = incoming.headersDistinct?.[lowerName];
  if (Array.isArray(distinct)) return distinct;

  const values: string[] = [];
  for (let index = 0; index < req.rawHeaders.length; index += 2) {
    if (req.rawHeaders[index]?.toLowerCase() === lowerName) {
      values.push(req.rawHeaders[index + 1] ?? "");
    }
  }
  if (values.length > 0) return values;

  const fallback = req.headers[lowerName];
  if (fallback === undefined) return [];
  return Array.isArray(fallback) ? fallback : [fallback];
}

function applyProtocolTransportGuard(
  req: Request,
  res: Response,
  next: NextFunction,
  standing: boolean
): void {
  const v01 = !standing && isV01Path(req.path);
  if (!v01 && !standing) {
    next();
    return;
  }

  // The standing profile resolves an exact route before parsing method or
  // content metadata. Unknown v0.2 paths therefore cannot be used as a JSON
  // parser oracle and always produce the same bounded route failure.
  const routeTarget = standing ? req.originalUrl : req.path;
  const standingMethod = standing ? standingRouteMethod(routeTarget) : null;
  if (standing && standingMethod === null) {
    sendTransportError(res, 404, "http_route_not_found", true);
    return;
  }

  const selectedRoutes = standing ? v02ProtocolRoutes : v01ProtocolRoutes;
  if (
    (standing && req.method !== standingMethod) ||
    (!standing && selectedRoutes.has(routeTarget) && req.method !== "POST")
  ) {
    res.set("Allow", standing ? standingMethod ?? "POST" : "POST");
    sendTransportError(res, 405, "http_method_not_allowed", standing);
    return;
  }

  if (req.method === "POST") {
    if (standing) {
      const contentEncodings = distinctHeaderValues(req, "content-encoding");
      const contentTypes = distinctHeaderValues(req, "content-type");
      if (
        contentEncodings.length > 0 ||
        contentTypes.length !== 1 ||
        !isJsonContentType(contentTypes[0])
      ) {
        sendTransportError(res, 415, "http_content_type_invalid", true);
        return;
      }
      const declaredLengths = distinctHeaderValues(req, "content-length");
      if (
        declaredLengths.length > 1 ||
        (declaredLengths.length === 1 &&
          !/^(?:0|[1-9][0-9]*)$/.test(declaredLengths[0]))
      ) {
        sendTransportError(res, 400, "http_body_invalid", true);
        return;
      }
      if (
        declaredLengths.length === 1 &&
        Number(declaredLengths[0]) > PROTOCOL_REQUEST_MAX_BYTES
      ) {
        sendTransportError(res, 413, "http_body_too_large", true);
        return;
      }
    } else {
      const contentEncoding = req.get("Content-Encoding");
      if (contentEncoding && contentEncoding.toLowerCase() !== "identity") {
        sendTransportError(res, 415, "http_content_type_invalid", false);
        return;
      }
      if (!isJsonContentType(req.get("Content-Type"))) {
        sendTransportError(res, 415, "http_content_type_invalid", false);
        return;
      }
    }
  }

  next();
}

/** Decode the already bounded v0.2 raw body without UTF-8 replacement. */
export function standingJsonBodyDecoder(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isV02RequestTarget(req.originalUrl, req.path)) {
    next();
    return;
  }
  if (req.method !== "POST") {
    next();
    return;
  }
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new Error("Standing protocol body is empty");
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(req.body);
    const value = JSON.parse(source) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Standing protocol body must be an object");
    }
    req.body = value;
    next();
  } catch {
    sendTransportError(res, 400, "http_body_invalid", true);
  }
}

/** Apply the v0.2 exact-route boundary before global CORS middleware. */
export function standingProtocolTransportGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isV02RequestTarget(req.originalUrl, req.path)) {
    next();
    return;
  }
  res.locals[STANDING_TRANSPORT_GUARD_APPLIED] = true;
  applyProtocolTransportGuard(req, res, next, true);
}

/** Retain the existing post-CORS v0.1 behavior and support direct use. */
export function protocolTransportGuard(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.locals[STANDING_TRANSPORT_GUARD_APPLIED] === true) {
    next();
    return;
  }
  applyProtocolTransportGuard(
    req,
    res,
    next,
    isV02RequestTarget(req.originalUrl, req.path)
  );
}

function applyProtocolResponsePolicy(
  req: Request,
  res: Response,
  next: NextFunction,
  standing: boolean
): void {
  if (!standing && !isV01Path(req.path)) {
    next();
    return;
  }

  const canonicalJson = standing ? canonicalV02Json : canonicalV01Json;

  res.set({
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
  });

  const originalSend = res.send.bind(res);

  const sendOversizeError = (): Response => {
    const payload = canonicalJson({
      error: {
        code: "receiver_internal_error",
        ...(standing ? { retryable: false } : {}),
      },
    });
    res.status(500);
    res.type("application/json");
    res.set("Content-Length", String(Buffer.byteLength(payload, "utf8")));
    return originalSend(payload);
  };

  res.json = ((body: unknown): Response => {
    const payload = canonicalJson(body);
    if (Buffer.byteLength(payload, "utf8") > PROTOCOL_RESPONSE_MAX_BYTES) {
      return sendOversizeError();
    }
    res.type("application/json");
    res.set("Content-Length", String(Buffer.byteLength(payload, "utf8")));
    return originalSend(payload);
  }) as Response["json"];

  res.send = ((body?: unknown): Response => {
    const contentType = res.get("Content-Type");
    if (typeof body === "string" && contentType?.toLowerCase().startsWith("application/json")) {
      if (Buffer.byteLength(body, "utf8") > PROTOCOL_RESPONSE_MAX_BYTES) {
        return sendOversizeError();
      }
      res.set("Content-Length", String(Buffer.byteLength(body, "utf8")));
    }
    return originalSend(body as any);
  }) as Response["send"];

  next();
}

/** Apply no-store and canonical v0.2 responses before any early CORS exit. */
export function standingProtocolResponsePolicy(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isV02RequestTarget(req.originalUrl, req.path)) {
    next();
    return;
  }
  res.locals[STANDING_RESPONSE_POLICY_APPLIED] = true;
  applyProtocolResponsePolicy(req, res, next, true);
}

/** Retain the existing post-CORS v0.1 response behavior and support direct use. */
export function protocolResponsePolicy(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.locals[STANDING_RESPONSE_POLICY_APPLIED] === true) {
    next();
    return;
  }
  applyProtocolResponsePolicy(
    req,
    res,
    next,
    isV02RequestTarget(req.originalUrl, req.path)
  );
}
