import type { NextFunction, Request, Response } from "express";

export function validateStandingProtocolFields(fields: readonly string[]) {
  return function validateStandingProtocolBodyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const body = req.body as Record<string, unknown>;
    const actual = Object.keys(body).sort();
    const expected = [...fields].sort();
    if (
      actual.length !== expected.length ||
      actual.some((field, index) => field !== expected[index])
    ) {
      res.status(400).json({
        error: {
          code: "http_body_invalid",
          retryable: false,
        },
      });
      return;
    }
    next();
  };
}
