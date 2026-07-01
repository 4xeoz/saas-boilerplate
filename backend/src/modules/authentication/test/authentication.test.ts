import request from "supertest";
import { createApp } from "../../../app";
import { seedTestUser, clearTestData } from "../../../test/helper";
import { afterAll, beforeAll, describe, it, expect } from "@jest/globals";

const app = createApp();

describe("Authentication API", () => {
    let userId: string;
    let token: string;

    beforeAll(async () => {
        const user = await seedTestUser();
        userId = user.user.id;
        token = user.token;
    });

    afterAll(async () => {
        await clearTestData(userId);
    });

    describe("GET /auth/me", () => {
        it("200 returns the authenticated user's profile", async () => {
            const res = await request(app)
                .get("/auth/me")
                .set("Authorization", `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.id).toBe(userId);
            expect(res.body.data).toHaveProperty("email");
            expect(res.body.data).toHaveProperty("name");
        });

        it("401 when not authenticated", async () => {
            const res = await request(app).get("/auth/me");
            expect(res.status).toBe(401);
        });
    });

    describe("POST /auth/logout", () => {
        it("200 logs out successfully", async () => {
            const res = await request(app).post("/auth/logout");
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
