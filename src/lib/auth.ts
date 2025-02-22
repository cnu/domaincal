import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./db"

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          if (!user) {
            throw new Error("Invalid email or password")
          }

          const isValidPassword = await compare(credentials.password, user.password)

          if (!isValidPassword) {
            throw new Error("Invalid email or password")
          }

          return {
            id: user.id.toString(),
            email: user.email,
          }
        } catch (error) {
          console.error("Auth error:", error)
          throw new Error("Invalid credentials")
        }
      }
    })
  ],
  pages: {
    signIn: "/", // We'll handle this via modal
    error: "/", // We'll handle errors in the modal
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
        }
      }
      return session
    }
  },
  session: {
    strategy: "jwt",
  },
}
