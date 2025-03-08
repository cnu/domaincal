import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { DomainService } from "@/services/domain.service";
import { DomainController } from "@/controllers/domain.controller";
import { serializeDomain, processDomainList } from "@/models/domain.model";

interface ErrorResponse {
  error: string;
}

export async function GET(request: NextRequest) {
  // For simple domain retrieval without pagination, use the controller
  if (!request.url.includes('page') && !request.url.includes('limit')) {
    return DomainController.getUserDomains();
  }
  
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse pagination parameters from URL
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  // Validate pagination parameters
  const validPage = page > 0 ? page : 1;
  const validLimit = limit > 0 && limit <= 50 ? limit : 10; // Cap at 50 items per page

  // Calculate skip for pagination
  const skip = (validPage - 1) * validLimit;

  // Get total count for pagination metadata
  const totalDomains = await prisma.domain.count({
    where: {
      users: {
        some: {
          userId: BigInt(session.user.id),
        },
      },
    },
  });

  // Get paginated domains
  const domains = await prisma.domain.findMany({
    where: {
      users: {
        some: {
          userId: BigInt(session.user.id),
        },
      },
    },
    orderBy: [
      // Sort by expiry date (nulls last)
      { domainExpiryDate: "desc" },
      // Secondary sort by name for domains with no expiry date
      { name: "asc" },
    ],
    skip,
    take: validLimit,
  });

  // Calculate total pages
  const totalPages = Math.ceil(totalDomains / validLimit);

  return NextResponse.json({
    domains: domains.map(serializeDomain),
    page: validPage,
    limit: validLimit,
    total: totalDomains,
    totalPages,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { domains, domain } = await request.json();

    // Support both single domain and multiple domains
    let domainList: string[] = [];
    if (domains && Array.isArray(domains)) {
      domainList = domains;
    } else if (domain) {
      domainList = [domain];
    }

    // Log the received domains for debugging
    console.log(
      `Received ${domainList.length} domains in request:`,
      domainList
    );

    if (domainList.length === 0) {
      return NextResponse.json(
        { error: "At least one domain is required" },
        { status: 400 }
      );
    }

    // Enforce maximum domains limit
    const MAX_DOMAINS = 20;
    if (domainList.length > MAX_DOMAINS) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_DOMAINS} domains allowed per request. You submitted ${domainList.length} domains.`,
          domainsSubmitted: domainList.length,
        },
        { status: 400 }
      );
    }

    // For anonymous users, just validate the domains and return
    if (!session?.user?.id) {
      // Process the domains to validate and sanitize them
      const { validDomains, invalidDomains } = processDomainList(domainList);

      if (invalidDomains.length > 0) {
        return NextResponse.json<ErrorResponse>(
          { error: `Invalid domain format: ${invalidDomains[0]}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        message: "Please sign in to track these domains",
        requiresAuth: true,
        domains: validDomains.map((d: string) => ({ name: d })),
      });
    }

    // Process domains using the domain service
    const result = await DomainService.addMultipleDomainsForUser(
      session.user.id,
      domainList
    );

    // Check if any domains were invalid
    if (result.invalid.length > 0) {
      return NextResponse.json<ErrorResponse>(
        { error: `Invalid domain format: ${result.invalid[0]}` },
        { status: 400 }
      );
    }

    // Return the results
    return NextResponse.json({
      domains: result.added,
      duplicates: result.duplicates,
      message:
        result.added.length > 0
          ? `Successfully added ${result.added.length} domain(s)`
          : "No new domains were added",
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "An error occurred while processing the request" },
      { status: 500 }
    );
  }
}
