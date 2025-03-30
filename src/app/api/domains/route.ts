import { NextRequest, NextResponse } from "next/server";
import { DomainController } from "@/controllers/domain.controller";
import { createLogger } from "@/lib/logger";

const logger = createLogger("DomainsApiRoute");

/**
 * GET handler for retrieving domains
 * Following MVC pattern: Route delegates to Controller
 */
export async function GET(request: NextRequest) {
  try {
    // Parse pagination parameters from URL
    const { searchParams } = new URL(request.url);

    // Check if pagination is requested
    if (searchParams.has("page") || searchParams.has("limit")) {
      const page = parseInt(searchParams.get("page") || "1", 10);
      const limit = parseInt(searchParams.get("limit") || "10", 10);

      // Delegate to controller for paginated domains
      return DomainController.getPaginatedDomains(page, limit);
    }

    // For simple domain retrieval without pagination, use the controller
    return DomainController.getUserDomains();
  } catch (error) {
    logger.error("Error in domains GET route:", error);

    return NextResponse.json(
      { error: "Failed to retrieve domains" },
      { status: 500 }
    );
  }
}

/**
 * POST handler for adding domains
 * Following MVC pattern: Route delegates to Controller
 */
export async function POST(request: NextRequest) {
  try {
    const { domains, domain } = await request.json();

    // Support both single domain and multiple domains
    let domainList: string[] = [];
    if (domains && Array.isArray(domains)) {
      domainList = domains;
    } else if (domain) {
      domainList = [domain];
    }

    if (domainList.length === 0) {
      return NextResponse.json(
        { error: "At least one domain is required" },
        { status: 400 }
      );
    }

    // Delegate to controller for domain processing
    return DomainController.addDomains(domainList);
  } catch (error) {
    logger.error("Error in domains POST route:", error);

    return NextResponse.json(
      { error: "Failed to process domain request" },
      { status: 500 }
    );
  }
}
