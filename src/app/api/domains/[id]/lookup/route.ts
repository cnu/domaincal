import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DomainLookupService } from "@/services/domain-lookup.service";
import prisma from "@/lib/prisma";

/**
 * POST handler to trigger a WHOIS lookup for a domain
 * This allows users to manually refresh domain information
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Extract and validate domain ID
    const resolvedParams = await params;
    const domainId = resolvedParams.id;
    if (!domainId || isNaN(Number(domainId))) {
      return NextResponse.json({ error: "Invalid domain ID" }, { status: 400 });
    }

    // 3. Check if domain exists and belongs to the user
    const userDomain = await prisma.userDomains.findUnique({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId: BigInt(domainId),
        },
      },
      include: {
        domain: true, // Include domain details for validation
      },
    });

    if (!userDomain || !userDomain.domain) {
      return NextResponse.json(
        { error: "Domain not found or not owned by user" },
        { status: 404 }
      );
    }

    // 4. Parse the request body for options with proper error handling
    let forceRefresh = false;
    const contentType = request.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      try {
        const body = await request.json();
        forceRefresh = body?.forceRefresh === true;
      } catch {
        // If parsing fails, proceed with default options
        console.warn('Failed to parse request body, using default options');
      }
    }

    // 5. Call the domain lookup service with proper error handling
    const result = await DomainLookupService.updateDomainInfo(domainId, forceRefresh);

    // 6. Handle different response scenarios with appropriate status codes
    if (!result.success) {
      if (result.onCooldown) {
        // If the domain is on cooldown, return a 429 status (Too Many Requests)
        return NextResponse.json(result, { status: 429 });
      } else {
        // For other errors, return a 400 status (Bad Request)
        return NextResponse.json(
          { 
            error: result.message || "Failed to lookup domain information",
            success: false 
          },
          { status: 400 }
        );
      }
    }

    // 7. Return successful response
    return NextResponse.json(result);
  } catch (error) {
    // 8. Handle unexpected errors
    console.error("Error looking up domain:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error details:", errorMessage);
    
    return NextResponse.json(
      { 
        error: "Failed to lookup domain information", 
        success: false,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
