import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      emailVerified: boolean
    }
    pendingDomains?: string[]
  }

  interface User {
    id: string
    email: string
    emailVerified: boolean
  }
}
