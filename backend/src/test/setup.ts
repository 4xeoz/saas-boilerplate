import { afterAll } from "@jest/globals";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

if (process.env.DATABASE_URL) {
    const prisma = require("../lib/prisma").default;
    afterAll(() => prisma.$disconnect());
}
