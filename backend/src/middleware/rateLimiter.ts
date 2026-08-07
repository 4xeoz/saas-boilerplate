import rateLimit from "express-rate-limit";

const tooManyRequests = {
  success: false,
  error: "TOO_MANY_REQUESTS",
  message: "Too many requests, try again later.",
};

// Login and token refresh. Tight, because these are credential endpoints.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

// Unauthenticated public writes, such as a signup or contact form. Without this the
// only public write endpoint in the app can be used to insert rows in bulk.
export const publicWriteRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});
