import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DomainLookupService } from "@/services/domain-lookup.service";
import prisma from "@/lib/prisma";

// Define the context type for dynamic route parameters
type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST handler to trigger a WHOIS lookup for a domain
 * This allows users to manually refresh domain information
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await the params Promise to get the id
    const resolvedParams = await params;
    const domainId = resolvedParams.id;

    // Check if domain exists and belongs to the user
    const userDomain = await prisma.userDomains.findUnique({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId: BigInt(domainId),
        },
      },
    });

    if (!userDomain) {
      return NextResponse.json(
        { error: "Domain not found or not owned by user" },
        { status: 404 }
      );
    }

    // Trigger the WHOIS lookup
    const updatedDomain = await DomainLookupService.updateDomainInfo(domainId);

    return NextResponse.json({ success: true, domain: updatedDomain });
  } catch (error) {
    console.error("Error looking up domain:", error);
    return NextResponse.json(
      { error: "Failed to lookup domain information" },
      { status: 500 }
    );
  }
}
