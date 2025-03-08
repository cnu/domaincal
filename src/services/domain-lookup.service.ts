import { prisma } from "@/lib/prisma";
import { DomainResponse, serializeDomain } from "@/models/domain.model";

interface WhoisCheckResponse {
  domain: string;
  result: string; // 'registered' or 'available'
}

interface WhoisQueryResponse {
  domain_name?: string;
  creation_date?: string;
  updated_date?: string;
  expiration_date?: string;
  create_date?: string;
  update_date?: string;
  expire_date?: string;
  domain_age?: number;
  whois_server?: string;
  emails?: string;
  registrar?:
    | string
    | {
        name?: string;
        url?: string;
        email?: string;
      };
  registrant?: {
    name?: string;
    organization?: string;
    email?: string;
  };
  name_servers?: string[];
  status?: string[] | string;
  // Additional properties that might be in the response
  [key: string]: string | number | object | null | undefined;
}

/**
 * Service for handling domain lookup operations using WHOIS API
 */
export class DomainLookupService {
  private static readonly API_KEY = process.env.WHOIS_API_KEY || "";
  private static readonly API_BASE_URL = "https://api.apilayer.com/whois";

  /**
   * Check if a domain is registered using WHOIS API
   * @param domainName The domain name to check
   * @returns Object with domain and registration status
   */
  static async checkDomainRegistration(
    domainName: string
  ): Promise<WhoisCheckResponse> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/check?domain=${domainName}`,
        {
          method: "GET",
          headers: {
            apikey: this.API_KEY,
          } as HeadersInit,
          redirect: "follow",
        }
      );

      if (!response.ok) {
        throw new Error(
          `WHOIS API check failed with status: ${response.status}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(
        `Error checking domain registration for ${domainName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get detailed WHOIS information for a domain
   * @param domainName The domain name to query
   * @returns Detailed WHOIS information
   */
  static async getDetailedWhoisInfo(
    domainName: string
  ): Promise<WhoisQueryResponse> {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/query?domain=${domainName}`,
        {
          method: "GET",
          headers: {
            apikey: this.API_KEY,
          } as HeadersInit,
          redirect: "follow",
        }
      );

      if (!response.ok) {
        throw new Error(
          `WHOIS API query failed with status: ${response.status}`
        );
      }

      const whoisData = await response.json();

      // Debug WHOIS response data
      const result = whoisData.result || whoisData;

      console.log(`WHOIS data for ${domainName}:`, {
        expiration_date: result.expiration_date,
        expire_date: result.expire_date,
        creation_date: result.creation_date,
        create_date: result.create_date,
        registrar: result.registrar,
        emails: result.emails,
        raw: whoisData,
      });

      // Return the result object if it exists, otherwise return the whole response
      return result;
    } catch (error) {
      console.error(`Error getting WHOIS info for ${domainName}:`, error);
      throw error;
    }
  }

  /**
   * Update domain information from WHOIS API
   * @param domainId The ID of the domain to update
   * @returns The updated domain information
   */
  static async updateDomainInfo(domainId: string): Promise<DomainResponse> {
    try {
      // Fetch the domain to ensure it exists
      const existingDomain = await prisma.domain.findUnique({
        where: { id: BigInt(domainId) },
      });

      if (!existingDomain) {
        throw new Error(`Domain with ID ${domainId} not found`);
      }

      // Check if the domain is registered
      const checkResult = await this.checkDomainRegistration(
        existingDomain.name
      );

      if (checkResult.result !== "registered") {
        // Update domain with registration status only
        const domain = await prisma.domain.update({
          where: { id: BigInt(domainId) },
          data: {
            domainUpdatedDate: new Date(),
            response: { status: checkResult.result },
          },
        });
        return serializeDomain(domain);
      }

      // Get detailed WHOIS information
      const whoisInfo = await this.getDetailedWhoisInfo(existingDomain.name);

      // Parse dates from WHOIS response - handle different API response formats
      // The result is already extracted in getDetailedWhoisInfo
      const expiryDate = whoisInfo.expiration_date
        ? new Date(whoisInfo.expiration_date)
        : whoisInfo.expire_date
        ? new Date(whoisInfo.expire_date)
        : null;

      console.log(`Update domain info - expiryDate:`, {
        expiration_date: whoisInfo.expiration_date,
        expire_date: whoisInfo.expire_date,
        parsed_date: expiryDate,
      });

      const createdDate = whoisInfo.creation_date
        ? new Date(whoisInfo.creation_date)
        : whoisInfo.create_date
        ? new Date(whoisInfo.create_date)
        : null;

      // Extract registrar information - handle different formats
      let registrar = null;
      if (typeof whoisInfo.registrar === "string") {
        registrar = whoisInfo.registrar;
      } else if (
        whoisInfo.registrar &&
        typeof whoisInfo.registrar === "object"
      ) {
        registrar = whoisInfo.registrar.name || null;
      }

      // Extract email information - handle different formats
      let emails = whoisInfo.emails || null;
      if (
        !emails &&
        whoisInfo.registrant &&
        typeof whoisInfo.registrant === "object"
      ) {
        emails = whoisInfo.registrant.email || null;
      }
      if (
        !emails &&
        whoisInfo.registrar &&
        typeof whoisInfo.registrar === "object"
      ) {
        emails = whoisInfo.registrar.email || null;
      }

      // Update the domain with the fetched information
      const domain = await prisma.domain.update({
        where: { id: BigInt(domainId) },
        data: {
          domainExpiryDate: expiryDate,
          domainCreatedDate: createdDate,
          domainUpdatedDate: new Date(),
          registrar,
          emails,
          response: JSON.parse(JSON.stringify(whoisInfo)),
        },
      });

      return serializeDomain(domain);
    } catch (error) {
      console.error(`Error updating domain info for ID ${domainId}:`, error);
      throw error;
    }
  }

  /**
   * Batch update domain information for a user
   * @param userId The ID of the user whose domains should be updated
   * @returns Number of domains updated
   */
  static async batchUpdateDomains(userId: string): Promise<number> {
    try {
      // Get domains for the user that haven't been updated recently
      const domains = await prisma.domain.findMany({
        where: {
          users: {
            some: {
              userId: BigInt(userId),
            },
          },
          // Only update domains that haven't been updated in the last 24 hours
          OR: [
            { domainUpdatedDate: null },
            {
              domainUpdatedDate: {
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
        take: 10, // Process in batches of 10 for performance
      });

      // No domains to update
      if (domains.length === 0) {
        return 0;
      }

      // Update each domain with WHOIS information
      let updatedCount = 0;
      for (const domain of domains) {
        try {
          await this.updateDomainInfo(domain.id.toString());
          updatedCount++;
        } catch (error) {
          console.error(`Error updating domain ${domain.name}:`, error);
          // Continue with other domains even if one fails
        }
      }

      return updatedCount;
    } catch (error) {
      console.error(`Error batch updating domains for user ${userId}:`, error);
      throw error;
    }
  }
}
