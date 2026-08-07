// backend/src/middleware/requireRole.ts
import { Request, Response, NextFunction } from "express";
import { err } from "../lib/response-helpers";
import type { PublicUser } from "../types/user.types";
import type { Role } from "../db/schema";

// Higher number = more power. Lets superadmin satisfy an admin check
// without listing every role at every call site.
const RANK: Record<Role, number> = {
  user: 0,
  admin: 1,
  superadmin: 2,
};

export function requireRole(minimum: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as PublicUser | undefined;

    // 401 = "I don't know who you are". 403 = "I know, and no."
    if (!user) {
      return res.status(401).json(err("UNAUTHORIZED", "Not authenticated."));
    }
    if (RANK[user.role] < RANK[minimum]) {
      return res.status(403).json(err("FORBIDDEN", "You do not have permission to do this."));
    }

    next();
  };
}
