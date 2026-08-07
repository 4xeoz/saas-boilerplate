import "dotenv/config";
import { z } from "zod";
import type { SignOptions, Secret } from "jsonwebtoken";

/**
 * Environment validation.
 *
 * The rule: in production every secret must be present, and the process
 * refuses to start otherwise. A missing JWT_SECRET that silently fell back to
 * a default would let anyone forge a token for any user, so failing loudly at
 * boot is far safer than running in a broken state.
 *
 * In development the same variables are optional and get obvious placeholder
 * values, so a fresh clone still runs with no setup.
 */

const isProduction = process.env.NODE_ENV === "production";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: isProduction
    ? z.string().min(32, "must be at least 32 characters in production")
    : z.string().min(1).default("dev-only-insecure-jwt-secret"),

  // Minutes, so the cookie maxAge and the JWT expiry can be derived from one
  // value instead of drifting apart.
  ACCESS_TOKEN_MINUTES: z.coerce.number().default(15),

  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CALLBACK_URL: z
    .string()
    .default("http://localhost:4000/auth/google/callback"),

  FRONTEND_URL: isProduction
    ? z.string().min(1, "is required in production (CORS depends on it)")
    : z.string().default("http://localhost:3000"),

  // Set to ".example.com" in production so cookies issued by the API
  // subdomain are visible to the frontend subdomain. Left unset in
  // development, where both run on localhost and are already the same host.
  COOKIE_DOMAIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

const accessTokenTtlMs = env.ACCESS_TOKEN_MINUTES * 60 * 1000;
const refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

export const appConfig = {
  nodeEnv: env.NODE_ENV,
  isProduction: isProduction,
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET as Secret,
  accessTokenTtlMs: accessTokenTtlMs,
  // jsonwebtoken accepts a number of SECONDS for expiresIn.
  jwtExpiresIn: (accessTokenTtlMs / 1000) as SignOptions["expiresIn"],
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: env.GOOGLE_CALLBACK_URL,
  frontendUrl: env.FRONTEND_URL,
  cookieDomain: env.COOKIE_DOMAIN,
  refreshTokenTtlMs: refreshTokenTtlMs,
};
