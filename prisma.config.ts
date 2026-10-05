import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads env files itself; mirror Next.js and read .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Migrations use the direct (non-pooled) connection when one is provided.
  datasource: { url: process.env.DIRECT_URL || process.env.DATABASE_URL },
});
