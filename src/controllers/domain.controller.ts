import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DomainService } from "@/services/domain.service";
import { DomainLookupService } from "@/services/domain-lookup.service";
import { processDomainList } from "@/models/domain.model";

/**
 * Domain Controller - Handles all domain-related HTTP requests and responses
 * Following MVC pattern: Controllers handle HTTP, Services handle business logic
 */
export class DomainController {
  /**
   * Get all domains for the authenticated user
   */
  static async getUserDomains() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const domains = await DomainService.getUserDomains(session.user.id);
      return NextResponse.json({ domains });
    } catch (error) {
      console.error("Error fetching domains:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch domains";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Get paginated domains for the authenticated user
   */
  static async getPaginatedDomains(page: number, limit: number) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const result = await DomainService.getPaginatedDomains(
        session.user.id,
        page,
        limit
      );
      return NextResponse.json(result);
    } catch (error) {
      console.error("Error fetching paginated domains:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch domains";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Add domains for the authenticated user
   */
  static async addDomains(domainList: string[]) {
    const session = await getServerSession(authOptions);
    const MAX_DOMAINS = 20;

    // Enforce maximum domains limit
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
        return NextResponse.json(
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

    try {
      // Process domains using the domain service
      const result = await DomainService.addMultipleDomainsForUser(
        session.user.id,
        domainList
      );

      // Check if any domains were invalid
      if (result.invalid.length > 0) {
        return NextResponse.json(
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
      console.error("Error adding domains:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add domains";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Lookup domain WHOIS information
   */
  static async lookupDomain(domainId: string, forceRefresh: boolean = false) {
    try {
      // 1. Authentication check
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // 2. Validate domain ID
      if (!domainId || isNaN(Number(domainId))) {
        return NextResponse.json(
          { error: "Invalid domain ID" },
          { status: 400 }
        );
      }

      // 3. Check if domain exists and belongs to the user
      const userOwnsDomain = await DomainService.checkUserOwnsDomain(
        session.user.id,
        domainId
      );

      if (!userOwnsDomain) {
        return NextResponse.json(
          { error: "Domain not found or not owned by user" },
          { status: 404 }
        );
      }

      // 4. Call the domain lookup service
      const result = await DomainLookupService.updateDomainInfo(
        domainId,
        forceRefresh
      );

      // 5. Handle different response scenarios
      if (!result.success) {
        if (result.onCooldown) {
          // If the domain is on cooldown, return a 429 status (Too Many Requests)
          return NextResponse.json(result, { status: 429 });
        } else {
          // For other errors, return a 400 status (Bad Request)
          return NextResponse.json(
            {
              error: result.message || "Failed to lookup domain information",
              success: false,
            },
            { status: 400 }
          );
        }
      }

      // 6. Return successful response
      return NextResponse.json(result);
    } catch (error) {
      // 7. Handle unexpected errors
      console.error("Error looking up domain:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error details:", errorMessage);

      // Check for timeout-related errors
      const isTimeoutError =
        errorMessage.includes("timeout") ||
        errorMessage.includes("FUNCTION_INVOCATION_TIMEOUT");

      return NextResponse.json(
        {
          error: isTimeoutError
            ? "The domain lookup is taking too long. This can happen with some domain registrars. Please try again later."
            : "Failed to lookup domain information",
          success: false,
          details:
            process.env.NODE_ENV === "development" ? errorMessage : undefined,
        },
        { status: isTimeoutError ? 504 : 500 }
      );
    }
  }
}
