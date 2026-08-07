import { afterAll } from "@jest/globals";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

if (process.env.DATABASE_URL) {
    const { pool } = require("../db");
    afterAll(() => pool.end());
}
