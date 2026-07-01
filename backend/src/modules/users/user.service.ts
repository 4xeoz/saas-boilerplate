import type { Profile as GoogleProfile } from "passport-google-oauth20";
import type { UserAccount } from "@prisma/client";
import prisma from "../../lib/prisma";
import type { PublicUser } from "../../types/user.types";

class UserService {
  async findById(id: string): Promise<UserAccount | null> {
    return prisma.userAccount.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    return prisma.userAccount.findUnique({ where: { email } });
  }

  async findByGoogleSubjectId(googleSubjectId: string): Promise<UserAccount | null> {
    return prisma.userAccount.findUnique({ where: { googleSubjectId } });
  }

  async findOrCreateByGoogleProfile(profile: GoogleProfile): Promise<UserAccount> {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error("Google profile does not contain an email");

    let user = await this.findByGoogleSubjectId(profile.id);
    if (user) {
      return prisma.userAccount.update({
        where: { id: user.id },
        data: { displayName: profile.displayName, avatarUrl: profile.photos?.[0]?.value },
      });
    }

    user = await this.findByEmail(email);
    if (user) {
      return prisma.userAccount.update({
        where: { id: user.id },
        data: {
          googleSubjectId: profile.id,
          displayName: profile.displayName,
          avatarUrl: profile.photos?.[0]?.value,
        },
      });
    }

    return prisma.userAccount.create({
      data: {
        email,
        googleSubjectId: profile.id,
        displayName: profile.displayName,
        avatarUrl: profile.photos?.[0]?.value,
        role: "user",
      },
    });
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
    return prisma.userAccount.update({
      where: { id },
      data: { displayName: name, avatarUrl },
    });
  }

  async deleteById(id: string): Promise<void> {
    await prisma.userAccount.delete({ where: { id } });
  }
}

export const userService = new UserService();
