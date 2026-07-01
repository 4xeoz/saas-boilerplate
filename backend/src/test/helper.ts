import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { appConfig } from "../config/config";

export async function seedTestUser() {
    const email = `test+${Date.now()}@example.com`;
    const user = await prisma.userAccount.create({
        data: { email, displayName: "Test User" },
    });
    const token = jwt.sign({ sub: user.id }, appConfig.jwtSecret, { expiresIn: "1h" });
    return { user, token };
}

export async function clearTestData(userId: string) {
    await prisma.userAccount.delete({ where: { id: userId } });
}
