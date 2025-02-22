import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { Domain } from "@prisma/client"

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
    const { domains, userId } = await req.json() as { domains: string[], userId: bigint }

    if (!Array.isArray(domains) || !userId) {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid request format" },
        { status: 400 }
      )
    }

    // Validate domains
    const validDomains = domains
      .map(domain => domain.trim())
      .filter(validateDomain)

    if (validDomains.length === 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "No valid domains provided" },
        { status: 400 }
      )
    }

    // Store domains in database and create user associations
    const results = await Promise.all(
      validDomains.map(async (domain) => {
        try {
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
                userId,
                domainId: domainRecord.id,
              },
            },
            create: {
              userId,
              domainId: domainRecord.id,
            },
            update: {}, // No updates needed if association exists
          })

          return serializeDomain(domainRecord)
        } catch (error) {
          console.error(`Error processing domain ${domain}:`, error)
          return { error: `Failed to process domain ${domain}` }
        }
      })
    )

    return NextResponse.json({ domains: results })
  } catch (error) {
    console.error("Error processing domains:", error)
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to process domains" },
      { status: 500 }
    )
  }
}
