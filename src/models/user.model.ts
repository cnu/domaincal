import { User as PrismaUser } from "@prisma/client";

export interface UserModel {
  id: string;
  email: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UserResponse {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string | null;
}

export const serializeUser = (user: PrismaUser): UserResponse => ({
  id: user.id.toString(),
  email: user.email,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt?.toISOString() ?? null,
});
