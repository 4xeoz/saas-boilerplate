import { Router } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { healthRouter } from "../modules/system-health/health.routes";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.send("Backend is running. Visit /health");
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
