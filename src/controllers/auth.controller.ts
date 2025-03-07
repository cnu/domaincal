import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";
import { toast } from "@/components/ui/use-toast";

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request) {
    try {
      const { email, password } = await req.json();

      if (!email || !password) {
        return NextResponse.json(
          { error: "Email and password are required" },
          { status: 400 }
        );
      }

      const user = await AuthService.registerUser(email, password);

      return NextResponse.json({ user });
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "An error occurred during registration";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  }

  /**
   * Process pending domains after authentication
   */
  static async processPendingDomains(userId: string, pendingDomains: string[]) {
    if (!pendingDomains || pendingDomains.length === 0) {
      return;
    }

    try {
      await AuthService.processPendingDomains(userId, pendingDomains);
    } catch (error) {
      console.error("Error processing pending domains:", error);
      toast({
        id: "failed-pending-domains",
        title: "Error",
        description: "Failed to process pending domains",
        variant: "destructive",
      });
    }
  }
}
