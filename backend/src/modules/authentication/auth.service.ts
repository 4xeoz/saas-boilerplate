import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "../../db";
import { refreshToken } from "../../db/schema";

class AuthService {
  /**
   * Revokes every live refresh token for one user.
   *
   * Called when a token is replayed. Rotation means a token is revoked as soon
   * as it is used, so presenting a revoked one means a copy escaped — the safe
   * assumption is theft. Killing the whole family logs out both the attacker
   * and the real user, who can simply sign in again.
   */
  async revokeAllForUser(userId: string): Promise<number> {
    const revoked = await db
      .update(refreshToken)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshToken.userId, userId), isNull(refreshToken.revokedAt)))
      .returning({ id: refreshToken.id });

    return revoked.length;
  }

  /**
   * Deletes refresh tokens that are past their expiry.
   *
   * Every refresh inserts a row and revokes the old one, so without this the
   * table grows forever — roughly 32 rows per active user per day. Expired
   * rows can never authenticate anything, so deleting them is safe.
   */
  async deleteExpiredTokens(): Promise<number> {
    const deleted = await db
      .delete(refreshToken)
      .where(lt(refreshToken.expiresAt, new Date()))
      .returning({ id: refreshToken.id });

    return deleted.length;
  }
}

export const authService = new AuthService();
