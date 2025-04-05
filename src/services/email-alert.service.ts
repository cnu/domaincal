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
        <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Domain Name</th>
              <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Expiry Date</th>
              <th style="border: 1px solid #dee2e6; padding: 12px; text-align: left;">Days Remaining</th>
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
                <td style="border: 1px solid #dee2e6; padding: 12px;">${domain.expiryDate.toLocaleDateString()}</td>
                <td style="border: 1px solid #dee2e6; padding: 12px;">${
                  domain.daysUntilExpiry
                } days</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      `;

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        replyTo: userData.emailVerified ? userData.email : undefined,
        to: userData.email,
        subject: `Domain Expiry Alert: Multiple Domains Expiring Soon`,
        html: `
          <h2>Domain Expiry Alerts</h2>
          <p>The following domains are expiring soon:</p>
          ${domainsTable}
          <p>Please take necessary action to renew these domains if needed.</p>
          <p>You can track your domain's status and manage your domains at <a href="${process.env.NEXT_PUBLIC_APP_URL}">${process.env.NEXT_PUBLIC_APP_URL}</a>.</p>
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
