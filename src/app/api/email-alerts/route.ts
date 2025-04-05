import { NextRequest, NextResponse } from "next/server";
import { EmailAlertService } from "@/services/email-alert.service";
import { logger } from "@/lib/logger";
import { getServerSession } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession({
      req: request,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await EmailAlertService.checkAndSendEmailAlerts();

    return NextResponse.json({
      message: "Email alerts processed successfully",
    });
  } catch (error) {
    logger.error("Error processing email alerts:", error);
    return NextResponse.json(
      { error: "Failed to process email alerts" },
      { status: 500 }
    );
  }
}
