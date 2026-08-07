/**
 * Drizzle schema.
 *
 * These tables were originally created by Prisma, so the identifiers are
 * PascalCase (tables) and camelCase (columns). Postgres folds unquoted
 * identifiers to lowercase, so every name is passed explicitly — dropping a
 * name string would make Drizzle look for `display_name` and fail at runtime.
 *
 * Two defaults are generated in application code rather than by the database,
 * because that is how Prisma behaved and the columns have no DB default:
 *   - uuid primary keys  (`@default(uuid())`)  -> $defaultFn
 *   - updatedAt          (`@updatedAt`)        -> $defaultFn + $onUpdate
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { randomUUID } from "crypto";

// Role is defined once in the shared package and re-exported here so schema
// consumers can keep importing it from the schema.
import type { Role } from "@saas/shared";
export type { Role };

export const userAccount = pgTable(
  "UserAccount",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    email: text("email").notNull().unique(),
    displayName: text("displayName"),
    avatarUrl: text("avatarUrl"),
    role: text("role").$type<Role>().notNull().default("user"),
    googleSubjectId: text("googleSubjectId").unique(),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (t) => [index("UserAccount_createdAt_idx").on(t.createdAt)]
);

export const refreshToken = pgTable(
  "RefreshToken",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    userId: uuid("userId")
      .notNull()
      .references(() => userAccount.id, { onDelete: "cascade", onUpdate: "cascade" }),
    tokenHash: text("tokenHash").notNull().unique(),
    expiresAt: timestamp("expiresAt", { precision: 3 }).notNull(),
    revokedAt: timestamp("revokedAt", { precision: 3 }),
    createdAt: timestamp("createdAt", { precision: 3 }).notNull().defaultNow(),
  },
  (t) => [
    index("RefreshToken_userId_idx").on(t.userId),
    // Supports the periodic delete of expired tokens.
    index("RefreshToken_expiresAt_idx").on(t.expiresAt),
  ]
);

// Relations power the `with:` option on the query API (Prisma's `include`).
export const userAccountRelations = relations(userAccount, ({ many }) => ({
  refreshTokens: many(refreshToken),
}));


export const refreshTokenRelations = relations(refreshToken, ({ one }) => ({
  user: one(userAccount, {
    fields: [refreshToken.userId],
    references: [userAccount.id],
  }),
}));



// Inferred row types — the replacements for the generated Prisma model types.
export type UserAccount = typeof userAccount.$inferSelect;
export type NewUserAccount = typeof userAccount.$inferInsert;
export type RefreshToken = typeof refreshToken.$inferSelect;

