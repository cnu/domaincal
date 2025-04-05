import { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { compare } from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { AuthService } from "@/services/auth.service";
import NextAuth from "next-auth";

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
            return null;
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
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.emailVerified = !!user.emailVerified;
      }

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
    signIn: "/api/auth/signin",
  },
  session: {
    strategy: "jwt",
  },
};

export const { getServerSession } = NextAuth(authOptions);
