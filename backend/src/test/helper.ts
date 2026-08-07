import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { userAccount } from "../db/schema";
import { appConfig } from "../config/config";

export async function seedTestUser() {
    const email = `test+${Date.now()}@example.com`;
    const insertedRows = await db
        .insert(userAccount)
        .values({ email, displayName: "Test User" })
        .returning();
    const user = insertedRows[0];
    const token = jwt.sign({ sub: user.id }, appConfig.jwtSecret, { expiresIn: "1h" });
    return { user, token };
}

export async function clearTestData(userId: string) {
    await db.delete(userAccount).where(eq(userAccount.id, userId));
}
