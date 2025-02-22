import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Domain } from "@prisma/client"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

interface DomainResponse {
  id: string
  name: string
  domainExpiryDate: Date | null
  createdAt: Date
  updatedAt: Date | null
}

interface ErrorResponse {
  error: string
}

const serializeDomain = (domain: Domain): DomainResponse => ({
  id: domain.id.toString(),
  name: domain.name,
  domainExpiryDate: domain.domainExpiryDate,
  createdAt: domain.createdAt,
  updatedAt: domain.updatedAt,
})

const validateDomain = (domain: string): boolean => {
  if (!domain || domain.includes(" ") || !domain.includes(".")) return false
  
  try {
    // Basic URL validation
    new URL(`http://${domain}`)
    return true
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await req.json()
    const domain = Array.isArray(body.domain) ? body.domain[0] : body.domain

    if (!domain || typeof domain !== "string") {
      return NextResponse.json<ErrorResponse>(
        { error: "Domain is required and must be a string" },
        { status: 400 }
      )
    }

    // Validate domain
    const validDomain = validateDomain(domain.trim())

    if (!validDomain) {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid domain format" },
        { status: 400 }
      )
    }

    // Try to find existing domain or create new one
    const existingDomain = await prisma.domain.findUnique({
      where: { name: domain },
    })

    let domainRecord: Domain

    if (existingDomain) {
      domainRecord = existingDomain
    } else {
      domainRecord = await prisma.domain.create({
        data: {
          name: domain,
          domainExpiryDate: null, // Will be updated by WHOIS service
        },
      })
    }

    // Create user-domain association if it doesn't exist
    await prisma.userDomains.upsert({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId: domainRecord.id,
        },
      },
      create: {
        userId: BigInt(session.user.id),
        domainId: domainRecord.id,
      },
      update: {}, // No updates needed if association exists
    })

    return NextResponse.json({
      domain: serializeDomain(domainRecord),
    })
  } catch (error) {
    console.error("Error processing domain:", error)
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to process domain" },
      { status: 500 }
    )
  }
}
