import { NextResponse } from "next/server";
import { DomainService } from "@/services/domain.service";
import { DomainLookupService } from "@/services/domain-lookup.service";
import { prisma } from "@/lib/prisma";
import { Domain } from "@prisma/client";

interface ApiResponse {
  success: boolean;
  error?: string;
  details?: string;
  apiKey?: string | null;
  env?: Record<string, string | undefined>;
  data?: unknown;
}

export async function GET() {
  const testDomain = "cnu.name";
  let domain: Domain | null = null;

  try {
    // Check if WHOIS API key is configured
    const apiKey = process.env.WHOIS_API_KEY;
    if (!apiKey) {
      console.error("WHOIS API key is not configured");
      const response: ApiResponse = {
        success: false,
        error: "WHOIS API key is not configured",
        details:
          "Please set WHOIS_API_KEY in your environment variables. You can do this by adding WHOIS_API_KEY=your_api_key to your .env file.",
        apiKey: apiKey,
        env: process.env,
      };
      return NextResponse.json(response, { status: 500 });
    }

    // First test the WHOIS API directly
    console.log(`Testing WHOIS API for ${testDomain}...`);
    let whoisInfo;
    try {
      whoisInfo = await DomainLookupService.getDetailedWhoisInfo(testDomain);
      if (!whoisInfo) {
        throw new Error("WHOIS API returned null response");
      }
      console.log("Raw WHOIS response:", JSON.stringify(whoisInfo, null, 2));
    } catch (error) {
      console.error("WHOIS API lookup failed:", error);
      return NextResponse.json(
        {
          success: false,
          error: `WHOIS API lookup failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          details: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 }
      );
    }

    // Create a test domain entry
    console.log(`\nCreating test domain entry for: ${testDomain}`);
    try {
      domain = await prisma.domain.create({
        data: {
          name: testDomain,
        },
      });
      console.log("Created domain:", domain);
    } catch (error) {
      console.error("Failed to create test domain:", error);
      const response: ApiResponse = {
        success: false,
        error: `Failed to create test domain: ${
          error instanceof Error ? error.message : String(error)
        }`,
        details: error instanceof Error ? error.stack : undefined,
      };
      return NextResponse.json(response, { status: 500 });
    }

    // Test the WHOIS data fetch
    console.log(`\nFetching WHOIS data for: ${testDomain}`);
    try {
      if (!domain) {
        throw new Error("Domain not created");
      }
      await DomainService.fetchWhoisDataInBackground(domain.id, domain.name);

      // Wait for the background task to complete
      console.log("Waiting for background task to complete...");
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Get the updated domain
      console.log("\nFetching updated domain...");
      const updatedDomain = await prisma.domain.findUnique({
        where: { id: domain.id },
      });

      if (!updatedDomain) {
        throw new Error("Domain not found after update");
      }

      console.log("Updated domain data:", {
        id: updatedDomain.id.toString(),
        name: updatedDomain.name,
        expiryDate: updatedDomain.domainExpiryDate,
        createdDate: updatedDomain.domainCreatedDate,
        updatedDate: updatedDomain.domainUpdatedDate,
        registrarInfo: {
          name: updatedDomain.registrarName,
          ianaId: updatedDomain.registrarIanaId,
          whoisServer: updatedDomain.registrarWhoisServer,
          url: updatedDomain.registrarUrl
        },
        response: updatedDomain.response,
      });

      const responseData = {
        success: true,
        data: {
          id: updatedDomain.id.toString(),
          name: updatedDomain.name,
          domainExpiryDate: updatedDomain.domainExpiryDate,
          domainCreatedDate: updatedDomain.domainCreatedDate,
          domainUpdatedDate: updatedDomain.domainUpdatedDate,
          registrarInfo: {
          name: updatedDomain.registrarName,
          ianaId: updatedDomain.registrarIanaId,
          whoisServer: updatedDomain.registrarWhoisServer,
          url: updatedDomain.registrarUrl
        },
          response: updatedDomain.response || null,
        },
        whoisInfo: whoisInfo || null,
      };

      const response: ApiResponse = {
        success: true,
        data: responseData,
      };
      return NextResponse.json(response);
    } catch (error) {
      console.error("Failed to fetch WHOIS data:", error);
      const response: ApiResponse = {
        success: false,
        error: `Failed to fetch WHOIS data: ${
          error instanceof Error ? error.message : String(error)
        }`,
        details: error instanceof Error ? error.stack : undefined,
      };
      return NextResponse.json(response, { status: 500 });
    }
  } catch (error) {
    console.error("WHOIS test failed:", error);

    // Clean up the test domain if it was created
    try {
      if (domain && typeof domain === "object" && "id" in domain) {
        await prisma.domain.delete({
          where: { id: (domain as Domain).id },
        });
        console.log("Cleaned up test domain");
      }
    } catch (cleanupError) {
      console.error("Error cleaning up test domain:", cleanupError);
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = errorMessage.includes("401")
      ? 401 // Authentication error
      : errorMessage.includes("429")
      ? 429 // Rate limit error
      : 500; // Other errors

    interface ErrorResponse {
      success: false;
      error: string;
      details?: string;
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: errorMessage,
    };

    if (process.env.NODE_ENV === "development") {
      errorResponse.details = String(error);
    }

    const response: ApiResponse = {
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? String(error) : undefined,
    };
    return NextResponse.json(response, { status: statusCode });
  }
}
