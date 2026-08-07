// backend/src/scripts/mint-token.ts
import "dotenv/config";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, pool, userAccount } from "../db";
import { appConfig } from "../config/config";

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run token -- <email>");

  const user = await db.query.userAccount.findFirst({
    where: eq(userAccount.email, email),
  });
  if (!user) throw new Error(`No user with email ${email}`);

  const token = jwt.sign(
    { sub: user.id, username: user.displayName, role: user.role },
    appConfig.jwtSecret,
    { expiresIn: "7d" }   // long-lived on purpose, dev only
  );

  // stdout carries ONLY the token, so it can be captured directly:
  //   TOKEN=$(npm run --silent token -- you@example.com)
  // Everything else goes to stderr, where it stays visible but out of the way.
  console.error(`user: ${user.email}  role: ${user.role}`);
  console.log(token);

  await pool.end();
}

main().catch((e) => { console.error(e.message); process.exit(1); });
