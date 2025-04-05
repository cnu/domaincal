import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailAlertService {
  private static readonly ALERT_DAYS = [14, 7, 1];

  /**
   * Check all domains for upcoming expiry dates and send alerts if needed
   */
  static async checkAndSendAlerts(): Promise<void> {
    try {
      // Get all active domains with expiry dates and user information
      const domains = await prisma.domain.findMany({
        where: {
          domainExpiryDate: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          domainExpiryDate: true,
          users: {
            select: {
              userId: true,
              user: {
                select: {
                  email: true,
                  emailVerified: true,
                },
              },
            },
          },
        },
      });

      // Type assertion to match our expected structure
      const typedDomains = domains as Array<{
        id: bigint;
        name: string;
        domainExpiryDate: Date | null;
        users: Array<{
          userId: bigint;
          user: {
            email: string;
            emailVerified: boolean;
          };
        }>;
      }>;

      for (const domain of typedDomains) {
        await this.processDomainAlerts(domain);
      }
    } catch (error) {
      logger.error("Error checking and sending email alerts:", error);
      throw error;
    }
  }

  /**
   * Process alerts for a single domain
   */
  private static async processDomainAlerts(domain: {
    id: bigint;
    name: string;
    domainExpiryDate: Date | null;
    users: Array<{
      userId: bigint;
      user: {
        email: string;
        emailVerified: boolean;
      };
    }>;
  }): Promise<void> {
    // Skip domains without expiry date
    if (!domain.domainExpiryDate) {
      return;
    }

    const daysUntilExpiry = Math.ceil(
      (domain.domainExpiryDate.getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Check if we need to send an alert for this domain
    if (!this.shouldSendAlert(daysUntilExpiry)) {
      return;
    }

    // Send alert to all users associated with this domain
    for (const user of domain.users) {
      await this.sendExpiryAlert(
        user.user.email,
        user.user.emailVerified ? user.user.email : null,
        domain.name,
        domain.domainExpiryDate,
        daysUntilExpiry
      );
    }
  }

  /**
   * Determine if an alert should be sent for the given number of days until expiry
   */
  private static shouldSendAlert(daysUntilExpiry: number): boolean {
    return this.ALERT_DAYS.some((alertDay) => alertDay === daysUntilExpiry);
  }

  /**
   * Send an expiry alert email
   */
  private static async sendExpiryAlert(
    email: string,
    name: string | null,
    domainName: string,
    expiryDate: Date,
    daysUntilExpiry: number
  ): Promise<void> {
    try {
      const formattedExpiryDate = expiryDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "domaincal@cruns.com",
        to: email,
        subject: `Domain Expiry Alert: ${domainName} expires in ${daysUntilExpiry} day(s)`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">Domain Expiry Alert</h1>
            
            <p style="color: #666; margin-bottom: 15px;">Dear ${name || "User"},</p>
            
            <p style="color: #666; margin-bottom: 15px;">
              This is a reminder that your domain <strong>${domainName}</strong> will expire in <strong>${daysUntilExpiry} day(s)</strong> on ${formattedExpiryDate}.
            </p>
            
            <p style="color: #666; margin-bottom: 20px;">
              Please ensure you renew your domain before the expiry date to avoid any service disruptions.
            </p>
            
            <p style="color: #666; margin-bottom: 15px;">
              You can track your domain's status and manage your domains at <a href="${
                process.env.NEXT_PUBLIC_APP_URL
              }">${process.env.NEXT_PUBLIC_APP_URL}</a>.
            </p>
            
            <p style="color: #666; margin-bottom: 15px;">
              Thank you for using DomainCal.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
            
            <p style="color: #999; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `,
      });

      logger.info(
        `Sent expiry alert for domain ${domainName} to ${email} (${daysUntilExpiry} days remaining)`
      );
    } catch (error) {
      logger.error(
        `Error sending expiry alert for domain ${domainName} to ${email}:`,
        error
      );
      throw error;
    }
  }
}
