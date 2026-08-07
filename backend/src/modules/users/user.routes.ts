import { Router, Request, Response } from "express";
import { jwtAuthGuard } from "../authentication/passport";
import { requireRole } from "../../middleware/requireRole";
import { userService } from "./public";
import { ok, err } from "../../lib/response-helpers";
import { asyncHandler } from "../../lib/async-handler";

export const userRouter = Router();

// Order matters: authenticate first (sets req.user), then authorise.
userRouter.get(
  "/",
  jwtAuthGuard(),
  requireRole("admin"),
  asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.listAll();
    return res.json(ok(users, "Users fetched."));
  })
);