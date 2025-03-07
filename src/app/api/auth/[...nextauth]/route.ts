import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { toast } from "@/components/ui/use-toast";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          toast({
            id: "missing-cred",
            title: "Error",
            description: "Missing credentials",
            variant: "destructive",
          });
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            toast({
              id: "invalid-email-pwd",
              title: "Error",
              description: "Invalid email or password",
              variant: "destructive",
            });
            return null;
          }

          const isValidPassword = await compare(
            credentials.password,
            user.password
          );

          if (!isValidPassword) {
            toast({
              id: "invalid-email-pwd",
              title: "Error",
              description: "Invalid email or password",
              variant: "destructive",
            });
          }

          return {
            id: user.id.toString(),
            email: user.email,
          };
        } catch (error) {
          console.error("Auth error:", error);
          toast({
            id: "invalid-cred",
            title: "Error",
            description: "Invalid Credentials",
            variant: "destructive",
          });
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/", // We'll handle this via modal
    error: "/", // We'll handle errors in the modal
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
        };
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

export { handler as GET, handler as POST };
