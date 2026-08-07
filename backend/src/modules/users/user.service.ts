import type { Profile as GoogleProfile } from "passport-google-oauth20";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { userAccount, type UserAccount } from "../../db/schema";
import type { PublicUser } from "../../types/user.types";

class UserService {
  async findById(id: string): Promise<UserAccount | null> {
    const row = await db.query.userAccount.findFirst({
      where: eq(userAccount.id, id),
    });
    return row ?? null;
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await db.query.userAccount.findFirst({
      where: eq(userAccount.email, email),
    });
    return row ?? null;
  }

  async findByGoogleSubjectId(googleSubjectId: string): Promise<UserAccount | null> {
    const row = await db.query.userAccount.findFirst({
      where: eq(userAccount.googleSubjectId, googleSubjectId),
    });
    return row ?? null;
  }

  async findOrCreateByGoogleProfile(profile: GoogleProfile): Promise<UserAccount> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error("Google profile does not contain an email");
    }

    const displayName = profile.displayName;
    const avatarUrl = profile.photos?.[0]?.value;

    // Match on the Google id first, then fall back to the email address so an
    // account created some other way gets linked instead of duplicated.
    let existing = await this.findByGoogleSubjectId(profile.id);
    if (!existing) {
      existing = await this.findByEmail(email);
    }

    if (existing) {
      const updatedRows = await db
        .update(userAccount)
        .set({
          googleSubjectId: profile.id,
          displayName: displayName,
          avatarUrl: avatarUrl,
        })
        .where(eq(userAccount.id, existing.id))
        .returning();
      return updatedRows[0];
    }

    const createdRows = await db
      .insert(userAccount)
      .values({
        email: email,
        googleSubjectId: profile.id,
        displayName: displayName,
        avatarUrl: avatarUrl,
        role: "user",
      })
      .returning();
    return createdRows[0];
  }

  toPublic(user: UserAccount): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl || undefined,
    };
  }

  async updateProfile(id: string, name: string, avatarUrl?: string): Promise<UserAccount> {
    const updatedRows = await db
      .update(userAccount)
      .set({ displayName: name, avatarUrl: avatarUrl })
      .where(eq(userAccount.id, id))
      .returning();
    return updatedRows[0];
  }

  async deleteById(id: string): Promise<void> {
    await db.delete(userAccount).where(eq(userAccount.id, id));
  }

  async listAll(): Promise<PublicUser[]> {
    const rows = await db.query.userAccount.findMany({
      orderBy: [desc(userAccount.createdAt)],
      limit: 100,
    });
    return rows.map((row) => this.toPublic(row));
  }
}

export const userService = new UserService();
