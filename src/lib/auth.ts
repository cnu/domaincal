import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"
import { compare, hash } from "bcryptjs"

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
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })

          if (!user) {
            // Create new user
            const hashedPassword = await hash(credentials.password, 10)
            const newUser = await prisma.user.create({
              data: {
                email: credentials.email,
                password: hashedPassword,
              },
            })

            // Return the new user
            return {
              id: newUser.id.toString(),
              email: newUser.email,
            }
          }

          const isPasswordValid = await compare(
            credentials.password,
            user.password
          )

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id.toString(),
            email: user.email,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
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
        session.user.id = token.id
        session.user.email = token.email

        // If there are pending domains in the session, add them to the user's domains
        if (session.pendingDomains?.length) {
          try {
            for (const domainName of session.pendingDomains) {
              // Find or create domain
              const domain = await prisma.domain.upsert({
                where: { name: domainName },
                create: { name: domainName },
                update: {},
              })

              // Link domain to user
              await prisma.userDomains.create({
                data: {
                  userId: BigInt(token.id),
                  domainId: domain.id,
                }
              })
            }

            // Clear pending domains
            delete session.pendingDomains
          } catch (error) {
            console.error("Error processing pending domains:", error)
          }
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
  },
}
