import { NextResponse } from "next/server";
import { DomainController } from "@/controllers/domain.controller";

/**
 * POST handler to trigger a domain refresh
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
    
    // Delegate to controller's static refreshDomain method
    // The controller will handle authentication and validation
    return await DomainController.refreshDomain(domainId);
  } catch (error) {
    // Handle any unexpected errors not caught by the controller
    console.error("Unexpected error in domain refresh route:", error);
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
