import { NextResponse } from "next/server";
import { DomainController } from "@/controllers/domain.controller";

/**
 * POST handler to trigger a WHOIS lookup for a domain
 * This allows users to manually refresh domain information
 * Following MVC pattern: Route delegates to Controller
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extract domain ID from params
    const resolvedParams = await params;
    const domainId = resolvedParams.id;
    
    // Parse the request body for options
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
    
    // Delegate to controller
    return DomainController.lookupDomain(domainId, forceRefresh);
  } catch (error) {
    // Handle any unexpected errors not caught by the controller
    console.error("Unexpected error in domain lookup route:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "An unexpected error occurred", 
        success: false,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
