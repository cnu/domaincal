import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Cannot use client components (toast) in server components
// Use proper error handling through NextAuth instead

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
