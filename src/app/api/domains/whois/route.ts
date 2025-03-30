import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  DomainLookupService,
  WhoisRegistrar,
} from "@/services/domain-lookup.service";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";

const logger = createLogger("WhoisApiRoute");

// Rate limiting configuration
const RATE_LIMIT = 10; // requests per minute
const COOLDOWN = 60 * 1000; // 1 minute in milliseconds
let lastRequestTime = Date.now();
let requestCount = 0;

/**
 * POST handler for processing WHOIS lookups in the background
 * This endpoint processes a batch of domains, respecting rate limits
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { domainIds } = await request.json();
    if (!Array.isArray(domainIds)) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    // Reset rate limit counter if enough time has passed
    const now = Date.now();
    if (now - lastRequestTime > COOLDOWN) {
      requestCount = 0;
      lastRequestTime = now;
    }

    // Check rate limit
    if (requestCount >= RATE_LIMIT) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    // Process domains with rate limiting
    const results = [];
    for (const domainId of domainIds) {
      try {
        // Check if the user owns this domain
        const userDomain = await prisma.userDomain.findFirst({
          where: {
            domainId: BigInt(domainId),
            userId: BigInt(session.user.id),
          },
          include: {
            domain: true,
          },
        });

        if (!userDomain) {
          results.push({
            domainId,
            status: "error",
            error: "Domain not found or not owned by user",
          });
          continue;
        }

        // Get WHOIS information
        const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
          userDomain.domain.name
        );
        requestCount++;

        // Update domain with WHOIS data
        const isRegistered =
          whoisInfo.status === true || whoisInfo.domain_registered === "yes";

        await prisma.domain.update({
          where: { id: BigInt(domainId) },
          data: {
            response: whoisInfo,
            registrar:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar !== null
                ? (whoisInfo.domain_registrar as WhoisRegistrar)
                    .registrar_name || null
                : null,
            domainExpiryDate: whoisInfo.expiry_date
              ? new Date(whoisInfo.expiry_date)
              : null,
            domainCreatedDate: whoisInfo.creation_date
              ? new Date(whoisInfo.creation_date)
              : null,
            domainUpdatedDate: whoisInfo.updated_date
              ? new Date(whoisInfo.updated_date)
              : new Date(),
            lastRefreshedAt: new Date(),
          },
        });

        results.push({
          domainId,
          status: "success",
          isRegistered,
        });

        // Add delay between requests to respect rate limits
        if (domainIds.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`Error processing domain ${domainId}:`, error);
        results.push({
          domainId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    logger.error("Error in WHOIS background processing:", error);
    return NextResponse.json(
      { error: "Failed to process WHOIS lookups" },
      { status: 500 }
    );
  }
}
