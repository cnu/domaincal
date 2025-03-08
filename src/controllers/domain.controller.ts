import { NextResponse } from "next/server";
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
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch domains";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }
}
