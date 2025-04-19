import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);

interface ExpiringDomain {
  name: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}

interface UserDomains {
  email: string;
  emailVerified: boolean;
  expiringDomains: ExpiringDomain[];
}

export class EmailAlertService {
  private static readonly ALERT_DAYS = [7, 1, 0];

  /**
   * Check all domains for upcoming expiry dates and send alerts if needed
   */
  public static async checkAndSendEmailAlerts(): Promise<void> {
    try {
      // Get all active domains with expiry dates and user information
      const domains = await prisma.domain.findMany({
        where: {
          domainExpiryDate: {
            not: null,
          },
        },
        include: {
          users: {
            include: {
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

      // Group domains by user
      const userDomains: Map<string, UserDomains> = new Map();

      for (const domain of domains) {
        if (!domain.domainExpiryDate) continue;

        const daysUntilExpiry = Math.ceil(
          (domain.domainExpiryDate.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (!this.shouldSendAlert(daysUntilExpiry)) continue;

        const expiringDomain: ExpiringDomain = {
          name: domain.name,
          expiryDate: domain.domainExpiryDate,
          daysUntilExpiry,
        };

        // Add domain to each user's list
        for (const userDomain of domain.users) {
          const userEmail = userDomain.user.email;
          if (!userDomains.has(userEmail)) {
            userDomains.set(userEmail, {
              email: userEmail,
              emailVerified: userDomain.user.emailVerified,
              expiringDomains: [],
            });
          }
          const userData = userDomains.get(userEmail);
          if (userData) {
            userData.expiringDomains.push(expiringDomain);
          }
        }
      }

      // Send a single email to each user with all their expiring domains
      for (const userData of userDomains.values()) {
        if (userData.expiringDomains.length > 0) {
          await this.sendExpiryAlertBatch(userData);
        }
      }
    } catch (error) {
      logger.error("Error checking domain expiry dates:", error);
      throw error;
    }
  }

  /**
   * Determine if an alert should be sent for the given number of days until expiry
   */
  private static shouldSendAlert(daysUntilExpiry: number): boolean {
    return this.ALERT_DAYS.some((alertDay) => alertDay === daysUntilExpiry);
  }

  /**
   * Send a batch expiry alert for multiple domains to a single user
   */
  private static async sendExpiryAlertBatch(
    userData: UserDomains
  ): Promise<void> {
    try {
      // Sort domains by days until expiry
      const sortedDomains = [...userData.expiringDomains].sort(
        (a, b) => a.daysUntilExpiry - b.daysUntilExpiry
      );

      // Create HTML table for domains
      const domainsTable = `
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0; font-family: Arial, sans-serif;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Domain</th>
              <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Expires In</th>
            </tr>
          </thead>
          <tbody>
            ${sortedDomains
              .map(
                (domain) => `
              <tr>
                <td style="border: 1px solid #dee2e6; padding: 12px;">${
                  domain.name
                }</td>
                <td style="border: 1px solid #dee2e6; padding: 12px;">${
                  domain.daysUntilExpiry
                } Day(s)</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;

      // Helper to get the highest severity among all domains
      const getHighestSeverity = (
        domains: ExpiringDomain[]
      ): "critical" | "urgent" | "warning" | null => {
        let hasCritical = false;
        let hasUrgent = false;
        let hasWarning = false;
        for (const d of domains) {
          if (d.daysUntilExpiry <= 0) hasCritical = true;
          else if (d.daysUntilExpiry <= 1) hasUrgent = true;
          else if (d.daysUntilExpiry <= 7) hasWarning = true;
        }
        if (hasCritical) return "critical";
        if (hasUrgent) return "urgent";
        if (hasWarning) return "warning";
        return null;
      };

      const getExpiryMessage = (
        severity: "critical" | "urgent" | "warning" | null
      ): string => {
        if (severity === "critical") {
          return `
      <div style="background-color: #fee2e2; border: 1px solid #ef4444; padding: 12px; margin: 12px 0; border-radius: 4px;">
        <strong>🚨 Critical: Domain Expired</strong>
        <ul style="margin: 8px 0;">
          <li>Your domain will be suspended soon if not renewed.</li>
          <li>After suspension, domain and attached services will stop functioning.</li>
        </ul>
      </div>
    `;
        } else if (severity === "urgent") {
          return `
      <div style="background-color: #fef2f2; border: 1px solid #f87171; padding: 12px; margin: 12px 0; border-radius: 4px;">
        <strong>⚠️ Urgent: Domain Expires Tomorrow</strong>
        <p>Immediate renewal required to avoid service interruption.</p>
      </div>
    `;
        } else if (severity === "warning") {
          return `
      <div style="background-color: #fff7ed; border: 1px solid #fb923c; padding: 12px; margin: 12px 0; border-radius: 4px;">
        <strong>⚠️ Warning: Domain Expiring Soon</strong>
        <p>Please renew your domain before expiration to avoid service interruption and potential loss of domain ownership.</p>
      </div>
    `;
        }
        return "";
      };

      const highestSeverity = getHighestSeverity(sortedDomains);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        replyTo: userData.emailVerified ? userData.email : undefined,
        to: userData.email,
        subject: `Domain Expiry Alert: ${sortedDomains.length} Domains Expiring Soon`,
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1f2937;">DomainCal</h2>
      ${getExpiryMessage(highestSeverity)}
      <p>The following domains require your attention:</p>
      ${domainsTable}
    </div>
  `,
      });

      logger.info(
        `Sent batch expiry alert to ${userData.email} for ${sortedDomains.length} domains`
      );
    } catch (error) {
      logger.error(
        `Error sending batch expiry alert to ${userData.email}:`,
        error
      );
      throw error;
    }
  }
}
