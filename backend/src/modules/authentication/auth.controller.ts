import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { appConfig } from "../../config/config";
import type { PublicUser } from "../../types/user.types";
import { userService } from "../users/public";
import { ok, err } from "../../lib/response-helpers";

export function googleAuthCallbackHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json(err("AUTH_FAILED", "Authentication failed."));
  }

  const user = req.user as PublicUser;

  const token = jwt.sign(
    { sub: user.id, username: user.name, role: user.role },
    appConfig.jwtSecret,
    { expiresIn: appConfig.jwtExpiresIn }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 1000,
    path: "/",
    sameSite: "lax",
  });

  return res.redirect(`${appConfig.frontendUrl}/dashboard`);
}

export async function profileHandler(req: Request, res: Response) {
  if (!req.user) {
    return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
  }

  const userId = (req.user as PublicUser).id;
  const user = await userService.findById(userId);

  if (!user) {
    return res.status(404).json(err("NOT_FOUND", "User not found."));
  }

  return res.json(ok(userService.toPublic(user), "User profile fetched successfully."));
}

export function logoutHandler() {
  return (_req: Request, res: Response) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });
    return res.json(ok(null, "Logged out successfully."));
  };
}
