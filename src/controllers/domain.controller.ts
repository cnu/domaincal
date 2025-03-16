import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DomainService } from "@/services/domain.service";
import { DomainLookupService } from "@/services/domain-lookup.service";
import { processDomainList } from "@/models/domain.model";
import { ApiResponse } from "@/utils/api-response";

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
      return ApiResponse.unauthorized();
    }

    try {
      const domains = await DomainService.getUserDomains(session.user.id);
      return ApiResponse.success({ domains });
    } catch (error) {
      console.error("Error fetching domains:", error);
      return ApiResponse.serverError(error, "Failed to fetch domains");
    }
  }

  /**
   * Get paginated domains for the authenticated user
   */
  static async getPaginatedDomains(page: number, limit: number) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return ApiResponse.unauthorized();
    }

    try {
      const result = await DomainService.getPaginatedDomains(
        session.user.id,
        page,
        limit
      );
      return ApiResponse.success(result);
    } catch (error) {
      console.error("Error fetching paginated domains:", error);
      return ApiResponse.serverError(error, "Failed to fetch domains");
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
        return ApiResponse.unauthorized();
      }

      // 2. Validate domain ID
      if (!domainId || isNaN(Number(domainId))) {
        return ApiResponse.validationError("Invalid domain ID");
      }

      // 3. Check if domain exists and belongs to the user
      const userOwnsDomain = await DomainService.checkUserOwnsDomain(
        session.user.id,
        domainId
      );

      if (!userOwnsDomain) {
        return ApiResponse.notFound("Domain not found or not owned by user");
      }

      // 4. Call the domain lookup service
      const result = await DomainLookupService.updateDomainInfo(
        domainId,
        forceRefresh
      );

      // 5. Handle different response scenarios
      if (!result.success) {
        if (result.message?.includes("cooldown")) {
          // If the domain is on cooldown, return a 429 status (Too Many Requests)
          return NextResponse.json(
            {
              success: false,
              error: result.message || "Domain lookup is on cooldown",
              onCooldown: true,
            },
            { status: 429 }
          );
        } else {
          // For other errors, return a 400 status (Bad Request)
          return ApiResponse.error(
            result.message || "Failed to lookup domain information",
            400
          );
        }
      }

      // 6. Return successful response
      return ApiResponse.success(result);
    } catch (error) {
      // 7. Handle unexpected errors
      console.error("Error looking up domain:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Check for timeout-related errors
      const isTimeoutError =
        errorMessage.includes("timeout") ||
        errorMessage.includes("FUNCTION_INVOCATION_TIMEOUT");

      if (isTimeoutError) {
        return NextResponse.json(
          {
            success: false,
            error: "The domain lookup is taking too long. This can happen with some domain registrars. Please try again later.",
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
          },
          { status: 504 }
        );
      }

      return ApiResponse.serverError(error, "Failed to lookup domain information");
    }
  }

  /**
   * Delete a domain for the authenticated user
   * @param domainId ID of the domain to delete
   */
  static async deleteDomain(domainId: string) {
    try {
      // 1. Authentication check
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return ApiResponse.unauthorized();
      }

      // 2. Validate domain ID
      if (!domainId || isNaN(Number(domainId))) {
        return ApiResponse.validationError("Invalid domain ID");
      }

      // 3. Check if domain exists and belongs to the user
      const userOwnsDomain = await DomainService.checkUserOwnsDomain(
        session.user.id,
        domainId
      );

      if (!userOwnsDomain) {
        return ApiResponse.notFound("Domain not found or not owned by user");
      }

      // 4. Call the domain service to delete the domain
      await DomainService.deleteDomainForUser(session.user.id, domainId);

      // 5. Return successful response
      return ApiResponse.success(
        { domainId },
        "Domain deleted successfully"
      );
    } catch (error) {
      // 6. Handle unexpected errors
      console.error("Error deleting domain:", error);
      return ApiResponse.serverError(error, "Failed to delete domain");
    }
  }

  /**
   * Refresh domain information
   * @param domainId ID of the domain to refresh
   */
  static async refreshDomain(domainId: string) {
    try {
      // 1. Authentication check
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return ApiResponse.unauthorized();
      }

      // 2. Validate domain ID
      if (!domainId || isNaN(Number(domainId))) {
        return ApiResponse.validationError("Invalid domain ID");
      }

      // 3. Check if domain exists and belongs to the user
      const userOwnsDomain = await DomainService.checkUserOwnsDomain(
        session.user.id,
        domainId
      );

      if (!userOwnsDomain) {
        return ApiResponse.notFound("Domain not found or not owned by user");
      }

      // 4. Call the domain lookup service with force refresh
      const result = await DomainLookupService.updateDomainInfo(
        domainId,
        true // Force refresh
      );

      // 5. Handle different response scenarios
      if (!result.success) {
        if (result.message?.includes("cooldown")) {
          // If the domain is on cooldown, return a 429 status (Too Many Requests)
          return NextResponse.json(
            {
              success: false,
              error: result.message || "Domain lookup is on cooldown",
              onCooldown: true,
            },
            { status: 429 }
          );
        } else {
          // For other errors, return a 400 status (Bad Request)
          return ApiResponse.error(
            result.message || "Failed to refresh domain information",
            400
          );
        }
      }

      // 6. Return successful response
      return ApiResponse.success(result);
    } catch (error) {
      // 7. Handle unexpected errors
      console.error("Error refreshing domain:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      
      // Check for timeout-related errors
      const isTimeoutError =
        errorMessage.includes("timeout") ||
        errorMessage.includes("FUNCTION_INVOCATION_TIMEOUT");

      if (isTimeoutError) {
        return NextResponse.json(
          {
            success: false,
            error: "The domain refresh is taking too long. This can happen with some domain registrars. Please try again later.",
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
          },
          { status: 504 }
        );
      }

      return ApiResponse.serverError(error, "Failed to refresh domain");
    }
  }
}
