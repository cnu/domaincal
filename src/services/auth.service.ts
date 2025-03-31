import { prisma } from "@/lib/prisma";
import { serializeUser, UserResponse } from "@/models/user.model";
import { hash, compare } from "bcryptjs";
import { EmailService } from "./email.service";
import crypto from "crypto";

export class AuthService {
  /**
   * Register a new user
   */
  static async registerUser(
    email: string,
    password: string
  ): Promise<UserResponse> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Return null or throw an error that can be handled by the UI layer
      throw new Error("Email already registered");
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        verificationToken,
        emailVerified: false,
      },
    });

    // Send verification email
    await EmailService.sendVerificationEmail(email, verificationToken);

    return serializeUser(user);
  }

  /**
   * Verify email address
   */
  static async verifyEmail(token: string): Promise<boolean> {
    console.log('Attempting to verify email with token:', token);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { verificationToken: token },
          {
            AND: [
              { emailVerified: true },
              { verificationToken: null }
            ]
          }
        ]
      }
    });

    console.log('Found user:', user);

    if (!user) {
      throw new Error("Invalid verification token");
    }

    // If already verified, return true without updating
    if (user.emailVerified && user.verificationToken === null) {
      console.log('User already verified');
      return true;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    console.log('Updated user:', updatedUser);

    return true;
  }

  /**
   * Resend verification email
   */
  static async resendVerificationEmail(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (user.emailVerified) {
      throw new Error("Email already verified");
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    await EmailService.sendVerificationReminderEmail(user.email, verificationToken);
  }

  /**
   * Authenticate a user
   */
  static async authenticateUser(
    email: string,
    password: string
  ): Promise<UserResponse | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    // Update last login time
    await prisma.$executeRaw`UPDATE "User" SET "lastLoginAt" = NOW() WHERE id = ${user.id}`;

    return serializeUser(user);
  }

  /**
   * Process pending domains for a user after authentication
   */
  static async processPendingDomains(
    userId: string,
    pendingDomains: string[]
  ): Promise<void> {
    if (!pendingDomains.length) return;

    try {
      for (const domainName of pendingDomains) {
        const domain = await prisma.domain.upsert({
          where: { name: domainName },
          create: { name: domainName },
          update: {},
        });

        await prisma.userDomain.create({
          data: {
            userId: BigInt(userId),
            domainId: domain.id,
          },
        });
      }
    } catch (error) {
      console.error("Error processing pending domains:", error);
      // Log the error but don't use toast in server-side code
      throw new Error("Failed to process pending domains");
    }
  }
}
