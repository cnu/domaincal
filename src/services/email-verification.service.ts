import { Resend } from "resend";
import { prisma } from "@/lib/db";
import crypto from "crypto";

interface SendVerificationEmailParams {
  userId: string;
  email: string;
}

class EmailVerificationService {
  /**
   * Generates a unique verification token for a user
   */
  async generateVerificationToken(userId: string): Promise<string> {
    const token = crypto.randomUUID();

    // Update user with the new verification token
    await prisma.user.update({
      where: { id: BigInt(userId) },
      data: { verificationToken: token },
    });

    return token;
  }

  /**
   * Sends a verification email to the user
   */
  async sendVerificationEmail({
    userId,
    email,
  }: SendVerificationEmailParams): Promise<boolean> {
    try {
      // Generate a verification token
      const token = await this.generateVerificationToken(userId);

      // Construct the verification URL
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

      // Create a simple HTML template instead of React component
      // This avoids potential issues with React components in server context
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h1 style="color: #333; font-size: 24px;">Welcome to DomainCal!</h1>
          <p style="font-size: 16px; color: #555;">
            Thank you for registering with DomainCal. To complete your registration and access all features,
            please verify your email address by clicking the button below:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a 
              href="${verificationUrl}" 
              style="background-color: #4F46E5; color: white; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block;"
            >
              Verify My Email
            </a>
          </div>
          <p style="font-size: 16px; color: #555;">
            If you did not create an account with DomainCal, you can safely ignore this email.
          </p>
          <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #888;">
            <p>&copy; ${new Date().getFullYear()} DomainCal. All rights reserved.</p>
          </div>
        </div>
      `;

      // Initialize Resend with API key for each email send to ensure key is loaded
      console.log('Initializing Resend with API key length:', process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.length : 0);
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY environment variable is not set');
        return false;
      }
      
      console.log('Email configuration:', {
        from: process.env.EMAIL_FROM || "DomainCal <noreply@domaincal.com>",
        to: email,
        hasHtmlContent: !!htmlContent,
      });
      
      // Send the email
      let result;
      try {
        result = await resend.emails.send({
          from: process.env.EMAIL_FROM || "DomainCal <noreply@domaincal.com>",
          to: email,
          subject: "Verify your email address for DomainCal",
          html: htmlContent,
        });
        console.log('Resend API response:', JSON.stringify(result, null, 2));
      } catch (sendError) {
        console.error('Exception during email sending:', sendError);
        return false;
      }

      if (result && result.error) {
        console.error("Failed to send verification email:", result.error);
        console.error("Error details:", JSON.stringify(result.error, null, 2));
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending verification email:", error);
      return false;
    }
  }

  /**
   * Verifies a user's email address using the provided token
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // Find the user with the verification token
      const user = await prisma.user.findFirst({
        where: { verificationToken: token },
      });

      if (!user) {
        return false;
      }

      // Update the user to mark email as verified and clear the token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationToken: null,
        },
      });

      return true;
    } catch (error) {
      console.error("Error verifying email:", error);
      return false;
    }
  }
}

export const emailVerificationService = new EmailVerificationService();
