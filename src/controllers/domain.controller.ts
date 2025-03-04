import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DomainService } from "@/services/domain.service";

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
      return NextResponse.json(
        { error: "Failed to fetch domains" },
        { status: 500 }
      );
    }
  }

  /**
   * Add a domain for the authenticated user
   */
  static async addDomain(request: NextRequest) {
    try {
      const session = await getServerSession(authOptions);
      const { domain } = await request.json();

      if (!domain) {
        return NextResponse.json(
          { error: "Domain is required" },
          { status: 400 }
        );
      }

      // Validate domain
      const validDomain = DomainService.validateDomainOnly(domain.trim());

      if (!validDomain) {
        return NextResponse.json(
          { error: "Invalid domain format" },
          { status: 400 }
        );
      }

      if (!session?.user?.id) {
        // For anonymous users, just validate the domain and return
        return NextResponse.json({
          message: "Please sign in to track this domain",
          requiresAuth: true,
          domain: { name: domain },
        });
      }

      // Add domain for user
      const domainResponse = await DomainService.addDomainForUser(
        session.user.id,
        domain.trim()
      );

      return NextResponse.json({
        message: "Domain added successfully",
        domain: domainResponse,
      });
    } catch (error) {
      console.error("Error adding domain:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add domain";
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  }
}
