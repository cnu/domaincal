import { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { compare, hash } from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { AuthService } from "@/services/auth.service";
import crypto from "crypto";
import { EmailService } from "@/services/email.service";

interface CustomSession extends Session {
  user: {
    id: string;
    email: string;
    name?: string | null;
    emailVerified: boolean;
  };
  pendingDomains?: string[];
}

interface CustomToken extends JWT {
  id: string;
  email: string;
  emailVerified: boolean;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            const hashedPassword = await hash(credentials.password, 10);
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const newUser = await prisma.user.create({
              data: {
                email: credentials.email,
                password: hashedPassword,
                emailVerified: false,
                verificationToken,
              },
            });

            // Send verification email
            await EmailService.sendVerificationEmail(credentials.email, verificationToken);

            return {
              id: newUser.id.toString(),
              email: newUser.email,
              emailVerified: false,
            };
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.password
          );

          if (!isPasswordValid) {
            return null;
          }

          return {
            id: user.id.toString(),
            email: user.email,
            emailVerified: user.emailVerified,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }): Promise<CustomToken> {
      // If this is a sign in operation, use the user object
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.emailVerified = !!user.emailVerified;
      }

      // On every token refresh, fetch the latest user data
      if (trigger === "update" || trigger === "signIn") {
        try {
          const latestUser = await prisma.user.findUnique({
            where: { id: BigInt(token.id as string) },
            select: {
              id: true,
              email: true,
              emailVerified: true,
            },
          });

          if (latestUser) {
            token.emailVerified = !!latestUser.emailVerified;
          }
        } catch (error) {
          console.error("Error fetching latest user data:", error);
        }
      }

      return token as CustomToken;
    },
    async session({ session, token }): Promise<CustomSession> {
      if (token && session.user) {
        const customToken = token as CustomToken;
        session.user.id = customToken.id;
        session.user.email = customToken.email;
        session.user.emailVerified = customToken.emailVerified;

        const customSession = session as CustomSession;
        if (customSession.pendingDomains?.length) {
          try {
            await AuthService.processPendingDomains(
              customToken.id,
              customSession.pendingDomains
            );
            delete customSession.pendingDomains;
          } catch (error) {
            console.error("Error processing pending domains:", error);
          }
        }
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: (token as CustomToken).id,
          email: (token as CustomToken).email,
          emailVerified: (token as CustomToken).emailVerified,
        },
      } as CustomSession;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
  session: {
    strategy: "jwt",
  },
};
