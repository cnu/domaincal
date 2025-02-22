import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { User } from "@prisma/client"

interface RegisterRequest {
  email: string
  password: string
}

interface RegisterResponse {
  user: {
    id: string
    email: string
    createdAt: string
    updatedAt: string | null
  }
}

interface ErrorResponse {
  error: string
}

const serializeUser = (user: User) => ({
  id: user.id.toString(),
  email: user.email,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt?.toISOString() ?? null,
})

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as RegisterRequest

    if (!email || !password) {
      return NextResponse.json<ErrorResponse>(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json<ErrorResponse>(
        { error: "Email already registered" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    return NextResponse.json<RegisterResponse>({
      user: serializeUser(user),
    })
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json<ErrorResponse>(
      { error: "An error occurred during registration" },
      { status: 500 }
    )
  }
}
