import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { User } from "@prisma/client"

interface LoginRequest {
  email: string
  password: string
}

interface LoginResponse {
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
    const { email, password } = (await req.json()) as LoginRequest

    if (!email || !password) {
      return NextResponse.json<ErrorResponse>(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    return NextResponse.json<LoginResponse>({
      user: serializeUser(user),
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json<ErrorResponse>(
      { error: "An error occurred during login" },
      { status: 500 }
    )
  }
}
