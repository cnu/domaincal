import { NextAuthOptions, Session } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./db";
import { compare, hash } from "bcryptjs";
import { JWT } from "next-auth/jwt";

interface CustomSession extends Session {
  user: {
    id: string;
    email: string;
    name?: string | null;
  };
  pendingDomains?: string[];
}

interface CustomToken extends JWT {
  id: string;
  email: string;
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
            const newUser = await prisma.user.create({
              data: {
                email: credentials.email,
                password: hashedPassword,
              },
            });

            return {
              id: newUser.id.toString(),
              email: newUser.email,
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
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }): Promise<CustomToken> {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token as CustomToken;
    },
    async session({ session, token }): Promise<CustomSession> {
      if (token && session.user) {
        const customToken = token as CustomToken;
        session.user.id = customToken.id;
        session.user.email = customToken.email;

        const customSession = session as CustomSession;
        if (customSession.pendingDomains?.length) {
          try {
            for (const domainName of customSession.pendingDomains) {
              const domain = await prisma.domain.upsert({
                where: { name: domainName },
                create: { name: domainName },
                update: {},
              });

              await prisma.userDomains.create({
                data: {
                  userId: BigInt(customToken.id),
                  domainId: domain.id,
                },
              });
            }

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
        },
      } as CustomSession;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
};
