import { prisma } from "@/lib/prisma";
import { DomainLookupResponse, serializeDomain } from "@/models/domain.model";
import { Domain as PrismaDomain } from "@prisma/client";

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
      // // Create a timeout promise that rejects after 5 seconds
      // const timeoutPromise = new Promise<never>((_, reject) => {
      //   setTimeout(() => {
      //     reject(
      //       new Error("Domain registration check timed out after 5 seconds")
      //     );
      //   }, 5000);
      // });

      // Create the fetch promise
      const fetchPromise = fetch(
        `${this.API_BASE_URL}/check?domain=${domainName}`,
        {
          method: "GET",
          headers: {
            apikey: this.API_KEY,
          } as HeadersInit,
          redirect: "follow",
        }
      );

      // Race the fetch against the timeout
      const response = await Promise.race([fetchPromise]);

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
      // Create a timeout promise that rejects after 8 seconds
      // const timeoutPromise = new Promise<never>((_, reject) => {
      //   setTimeout(() => {
      //     reject(new Error("WHOIS query timed out after 8 seconds"));
      //   }, 8000);
      // });

      // Create the fetch promise
      const fetchPromise = fetch(
        `${this.API_BASE_URL}/query?domain=${domainName}`,
        {
          method: "GET",
          headers: {
            apikey: this.API_KEY,
          } as HeadersInit,
          redirect: "follow",
        }
      );

      // Race the fetch against the timeout
      const response = await Promise.race([fetchPromise]);

      if (!response.ok) {
        throw new Error(
          `WHOIS API query failed with status: ${response.status}`
        );
      }

      const whoisData = await response.json();

      // Debug WHOIS response data
      const result = whoisData.result || whoisData;

      // console.log(`WHOIS data for ${domainName}:`, {
      //   expiration_date: result.expiration_date,
      //   expire_date: result.expire_date,
      //   creation_date: result.creation_date,
      //   create_date: result.create_date,
      //   registrar: result.registrar,
      //   emails: result.emails,
      //   raw: whoisData,
      // });

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
   * @param forceRefresh Whether to force refresh even if on cooldown
   * @returns A structured response with the domain information or error details
   */
  static async updateDomainInfo(
    domainId: string,
    forceRefresh: boolean = false
  ): Promise<DomainLookupResponse> {
    try {
      // 1. Validate inputs
      if (!domainId || isNaN(Number(domainId))) {
        return {
          success: false,
          message: "Invalid domain ID provided",
          domain: null as unknown as DomainLookupResponse["domain"],
        };
      }

      // 2. Validate API key before proceeding
      if (!this.API_KEY) {
        console.error(
          "WHOIS API key is not configured in environment variables"
        );
        return {
          success: false,
          message:
            "WHOIS API key is not configured. Please configure the API key in the environment variables.",
          domain: null as unknown as DomainLookupResponse["domain"],
        };
      }

      // 3. Fetch the domain to ensure it exists
      let existingDomain;
      try {
        existingDomain = await prisma.domain.findUnique({
          where: { id: BigInt(domainId) },
        });
      } catch (error) {
        console.error(`Error fetching domain with ID ${domainId}:`, error);
        return {
          success: false,
          message: `Error fetching domain: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          domain: null as unknown as DomainLookupResponse["domain"],
        };
      }

      if (!existingDomain) {
        return {
          success: false,
          message: `Domain with ID ${domainId} not found`,
          domain: null as unknown as DomainLookupResponse["domain"],
        };
      }

      // Check if the domain was refreshed within the last 24 hours
      // Use type assertion with interface that includes the new field
      const domainWithRefresh = existingDomain as PrismaDomain & {
        lastRefreshedAt?: Date | null;
      };

      if (!forceRefresh && domainWithRefresh.lastRefreshedAt) {
        const lastRefreshed = new Date(domainWithRefresh.lastRefreshedAt);
        const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const cooldownEnds = new Date(lastRefreshed.getTime() + cooldownPeriod);
        const now = new Date();

        if (now < cooldownEnds) {
          // Calculate time remaining in the cooldown period
          const timeRemaining = cooldownEnds.getTime() - now.getTime();
          const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));
          
          // Create serialized domain with cooldown information
          const serializedDomain = serializeDomain(domainWithRefresh as PrismaDomain);
          serializedDomain.onCooldown = true;
          serializedDomain.cooldownEndsAt = cooldownEnds;
          
          // Return a structured response instead of throwing an error
          return {
            success: false,
            onCooldown: true,
            hoursRemaining,
            message: `Domain refresh on cooldown. Please try again in ${hoursRemaining} hour${
              hoursRemaining === 1 ? "" : "s"
            }.`,
            domain: serializedDomain,
          } as DomainLookupResponse;
        }
      }

      // 5. Check if the domain is registered
      let checkResult;
      try {
        checkResult = await this.checkDomainRegistration(existingDomain.name);
      } catch (error) {
        console.error(
          `Error checking domain registration for ${existingDomain.name}:`,
          error
        );
        return {
          success: false,
          message: `Failed to check domain registration: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          domain: serializeDomain(existingDomain),
        };
      }

      if (checkResult.result !== "registered") {
        // Update domain with registration status only
        try {
          const domain = await prisma.domain.update({
            where: { id: BigInt(domainId) },
            data: {
              domainUpdatedDate: new Date(),
              response: { status: checkResult.result },
              ...({ lastRefreshedAt: new Date() } as { lastRefreshedAt: Date }),
            },
          });
          return { success: true, domain: serializeDomain(domain) };
        } catch (error) {
          console.error(
            `Error updating domain status for ${existingDomain.name}:`,
            error
          );
          return {
            success: false,
            message: `Failed to update domain status: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            domain: serializeDomain(existingDomain),
          };
        }
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

      // console.log(`Update domain info - expiryDate:`, {
      //   expiration_date: whoisInfo.expiration_date,
      //   expire_date: whoisInfo.expire_date,
      //   parsed_date: expiryDate,
      // });

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
          ...({ lastRefreshedAt: new Date() } as { lastRefreshedAt: Date }),
          registrar,
          emails,
          response: JSON.parse(JSON.stringify(whoisInfo)),
        },
      });

      return { success: true, domain: serializeDomain(domain) };
    } catch (error) {
      console.error(`Error updating domain info for ID ${domainId}:`, error);
      // Return a structured error response instead of throwing
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: `Failed to update domain information: ${errorMessage}`,
        domain: null as unknown as DomainLookupResponse["domain"],
      };
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
