import { NextRequest, NextResponse } from "next/server";
import { DomainController } from "@/controllers/domain.controller";

// Define the context type for dynamic route parameters
type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * DELETE handler for removing a domain from tracking
 * Following MVC pattern: Route delegates to Controller
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    // Await the params Promise to get the id
    const resolvedParams = await params;
    const domainId = resolvedParams.id;
    
    // Delegate to controller
    return DomainController.deleteDomain(domainId);
  } catch (error) {
    console.error("Error in domain DELETE route:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json(
      { 
        error: "Failed to delete domain", 
        success: false,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}
