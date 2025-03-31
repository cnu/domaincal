import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth.service";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.log('Received verification request with body:', body);
        const { token } = body;

        if (!token) {
            console.log('Token is missing in request');
            return NextResponse.json(
                { error: "Verification token is required" },
                { status: 400 }
            );
        }

        console.log('Attempting to verify email with token:', token);
        await AuthService.verifyEmail(token);
        console.log('Email verification successful');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Email verification error:", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An error occurred during email verification";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required" },
                { status: 400 }
            );
        }

        await AuthService.resendVerificationEmail(userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Resend verification email error:", error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : "An error occurred while resending verification email";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 