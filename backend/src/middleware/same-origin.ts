import { Request, Response, NextFunction } from "express";
import { appConfig } from "../config/config";

export function requireSameOriginJson(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.get("origin") !== appConfig.frontendUrl) {
    return res.status(403).json({ error: { code: "csrf_origin_invalid" } });
  }
  if (!req.is("application/json")) {
    return res.status(415).json({ error: { code: "http_content_type_invalid" } });
  }
  next();
}
