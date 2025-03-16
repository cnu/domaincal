import { NextResponse } from "next/server";

/**
 * Standard API response format for consistent error handling and responses
 * This ensures all API endpoints return data in the same format
 */
export class ApiResponse {
  /**
   * Create a success response
   * @param data The data to return
   * @param message Optional success message
   * @param status HTTP status code (default: 200)
   */
  static success<T>(data: T, message?: string, status = 200) {
    return NextResponse.json(
      {
        success: true,
        message,
        data,
      },
      { status }
    );
  }

  /**
   * Create an error response
   * @param message Error message
   * @param status HTTP status code (default: 400)
   * @param details Additional error details (only included in development)
   */
  static error(message: string, status = 400, details?: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: message,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status }
    );
  }

  /**
   * Create an unauthorized response
   * @param message Optional custom message
   */
  static unauthorized(message = "Unauthorized") {
    return this.error(message, 401);
  }

  /**
   * Create a not found response
   * @param message Optional custom message
   */
  static notFound(message = "Resource not found") {
    return this.error(message, 404);
  }

  /**
   * Create a validation error response
   * @param message Validation error message
   * @param details Validation error details
   */
  static validationError(message: string, details?: unknown) {
    return this.error(message, 422, details);
  }

  /**
   * Create a server error response
   * @param error The error object
   * @param message Optional custom message
   */
  static serverError(error: unknown, message = "Internal server error") {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Server error: ${errorMessage}`);
    
    return this.error(message, 500, errorMessage);
  }
}
