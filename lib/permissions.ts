import type { Role } from "@prisma/client";

export function canManageWorkspace(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageRoles(role: Role) {
  return role === "OWNER";
}
