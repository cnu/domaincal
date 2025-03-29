import { prisma } from "@/lib/prisma";
import { DomainLookupResponse, serializeDomain } from "@/models/domain.model";
import { Domain as PrismaDomain } from "@prisma/client";

export interface WhoisRegistrar {
  iana_id?: string;
  registrar_name?: string;
  whois_server?: string;
  website_url?: string;
  email?: string;
}

export interface WhoisDateFields {
  expiry_date?: string;
  expiration_date?: string;
  expire_date?: string;
  creation_date?: string;
  create_date?: string;
  updated_date?: string;
  update_date?: string;
}

interface WhoisRegistryData {
  domain_name?: string;
  query_time?: string;
  whois_server?: string;
  domain_registered?: string;
  create_date?: string;
  update_date?: string;
  expiry_date?: string;
  domain_registrar?: WhoisRegistrar;
  name_servers?: string[];
  domain_status?: string[];
  dnssec?: string;
  dnssec_ds_data?: string;
  whois_raw_registery?: string;
}

export interface WhoisQueryResponse extends WhoisDateFields {
  // Basic domain info
  domain_name?: string;
  status?: boolean;
  query_time?: string;
  whois_server?: string;
  domain_registered?: string;

  domain_age?: number;

  // Raw WHOIS data
  whois_raw_domain?: string;
  whois_raw_registery?: string;

  // Registry data
  registry_data?: WhoisRegistryData;

  // Additional properties that might be in the response
  [key: string]: string | number | boolean | object | null | undefined;
}

/**
 * Service for handling domain lookup operations using WHOIS API
 */
export class DomainLookupService {
  private static readonly API_KEY = process.env.WHOIS_API_KEY || "";
  private static readonly API_BASE_URL = "https://api.whoisfreaks.com/v1.0";

  /**
   * Validate the WHOIS API key configuration
   * @throws Error if API key is not properly configured
   */
  private static validateApiKey(): void {
    if (!this.API_KEY || this.API_KEY.length < 32) {
      console.error("WHOIS API key is not set or appears invalid", {
        hasKey: !!this.API_KEY,
        keyLength: this.API_KEY?.length || 0,
        environment: process.env.NODE_ENV
      });
      throw new Error("WHOIS API key is not properly configured");
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
      // Validate API key configuration
      this.validateApiKey();

      // Log API configuration
      console.log('WHOIS API Configuration:', {
        baseUrl: this.API_BASE_URL,
        hasApiKey: !!this.API_KEY,
        apiKeyLength: this.API_KEY?.length || 0
      });

      // Construct API URL
      // Set a timeout for the API request
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        console.warn(`WHOIS API request timeout for ${domainName}`);
        controller.abort();
      }, 10000); // 10 second timeout

      try {
        const apiUrl = `${this.API_BASE_URL}/whois?whois=live&domainName=${domainName}&apiKey=${this.API_KEY}`;
        console.log(`Fetching WHOIS data for ${domainName}...`);

        // Make the API call with timeout and caching
        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          } as HeadersInit,
          signal: controller.signal,
          cache: 'no-store', // Disable caching for now to debug
        }).catch((error) => {
          if (error.name === 'AbortError') {
            throw new Error(`WHOIS API request timed out after 10 seconds for domain ${domainName}`);
          }
          throw error;
        });

        if (!response) {
          throw new Error(`No response received from WHOIS API for domain ${domainName}`);
        }

        if (response.status === 429) { // Rate limit hit
          console.warn(`Rate limit hit for domain ${domainName}, backing off...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
          throw new Error('Rate limit hit, please try again');
        }

        if (!response.ok) {
          const errorText = await response.text();
          const errorDetails = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: errorText
          };
          console.error(`WHOIS API error for ${domainName}:`, errorDetails);
          throw new Error(`WHOIS API failed with status ${response.status}: ${errorText}`);
        }

        const whoisData = await response.json();

        if (!whoisData || typeof whoisData !== 'object') {
          throw new Error(`Invalid WHOIS API response for ${domainName}: ${JSON.stringify(whoisData)}`);
        }

        return whoisData as WhoisQueryResponse;
      } catch (error: unknown) {
        console.error(`Error fetching WHOIS data for ${domainName}:`, error);

        // Handle specific error types
        if (error instanceof Error) {
          if (error.name === 'AbortError' || error.message.includes('timeout')) {
            throw new Error(`WHOIS API request timed out after 10 seconds for domain ${domainName}. Please try again later.`);
          } else if (error.message.includes('Rate limit')) {
            throw new Error(`WHOIS API rate limit exceeded for domain ${domainName}. Please wait a few minutes and try again.`);
          }
        }

        // Default error
        throw new Error(`Failed to fetch WHOIS data for domain ${domainName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        clearTimeout(timeout);
      }

      // Helper function to parse date strings
      const parseDate = (dateStr?: string): Date | null => {
        if (!dateStr) return null;
        try {
          const date = new Date(dateStr);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      };

      // Get WHOIS data
      const whoisData = await this.getDetailedWhoisInfo(domainName);

      // Extract registrar info
      const registrarInfo = (whoisData.domain_registrar || {}) as WhoisRegistrar;

      // Helper function to check if a value indicates a registered domain
      const isRegistered = (value: unknown): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.toLowerCase() === 'yes';
        return false;
      };

      // Helper function to safely get string array
      const getStringArray = (value: unknown): string[] => {
        if (!Array.isArray(value)) return [];
        return value.filter((item): item is string => typeof item === 'string');
      };

      // Create normalized response
      const normalizedResponse: WhoisQueryResponse = {
        domain_name: String(whoisData.domain_name || ''),
        status: isRegistered(whoisData.status) || isRegistered(whoisData.domain_registered),
        query_time: String(whoisData.query_time || ''),
        whois_server: String(whoisData.whois_server || ''),
        domain_registered: isRegistered(whoisData.status) || isRegistered(whoisData.domain_registered) ? 'yes' : 'no',
        create_date: parseDate(String(whoisData.create_date || ''))?.toISOString() || '',
        update_date: parseDate(String(whoisData.update_date || ''))?.toISOString() || '',
        expiry_date: parseDate(String(whoisData.expiry_date || ''))?.toISOString() || '',
        domain_registrar: {
          iana_id: String(registrarInfo.iana_id || ''),
          registrar_name: String(registrarInfo.registrar_name || ''),
          whois_server: String(registrarInfo.whois_server || ''),
          website_url: String(registrarInfo.website_url || ''),
          email: String(registrarInfo.email || ''),
        },
        name_servers: getStringArray(whoisData.name_servers),
        domain_status: getStringArray(whoisData.domain_status),
        whois_raw_domain: String(whoisData.whois_raw_domain || ''),
      };

      console.log(`Normalized WHOIS data for ${domainName}:`, {
        expiry_date: normalizedResponse.expiry_date,
        create_date: normalizedResponse.create_date,
        update_date: normalizedResponse.update_date,
        registrar: normalizedResponse.domain_registrar,
      });

      return normalizedResponse;
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
    let existingDomain: PrismaDomain | null = null;
    try {
      // 1. Validate inputs
      if (!domainId || isNaN(Number(domainId))) {
        return {
          success: false,
          message: "Invalid domain ID provided",
          domain: {
            id: domainId || '0',
            name: 'Unknown',
            response: {},
            registrar: null,
            emails: null,
            domainExpiryDate: null,
            domainCreatedDate: null,
            domainUpdatedDate: null,
            createdAt: new Date(),
            updatedAt: null,
            lastRefreshedAt: null,
            onCooldown: false,
            cooldownEndsAt: null,
          },
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
          domain: {
            id: domainId,
            name: 'Unknown',
            response: {},
            registrar: null,
            emails: null,
            domainExpiryDate: null,
            domainCreatedDate: null,
            domainUpdatedDate: null,
            createdAt: new Date(),
            updatedAt: null,
            lastRefreshedAt: null,
            onCooldown: false,
            cooldownEndsAt: null,
          },
        };
      }

      // 3. Fetch the domain to ensure it exists and check refresh cooldown
      try {
        existingDomain = await prisma.domain.findUnique({
          where: { id: BigInt(domainId) },
        });
      } catch (error) {
        console.error(`Error fetching domain with ID ${domainId}:`, error);
        return {
          success: false,
          message: `Error fetching domain: ${error instanceof Error ? error.message : "Unknown error"
            }`,
          domain: {
            id: domainId,
            name: 'Unknown',
            response: {},
            registrar: null,
            emails: null,
            domainExpiryDate: null,
            domainCreatedDate: null,
            domainUpdatedDate: null,
            createdAt: new Date(),
            updatedAt: null,
            lastRefreshedAt: null,
            onCooldown: false,
            cooldownEndsAt: null,
          },
        };
      }

      if (!existingDomain) {
        return {
          success: false,
          message: `Domain with ID ${domainId} not found`,
          domain: {
            id: domainId,
            name: 'Unknown',
            response: {},
            registrar: null,
            emails: null,
            domainExpiryDate: null,
            domainCreatedDate: null,
            domainUpdatedDate: null,
            createdAt: new Date(),
            updatedAt: null,
            lastRefreshedAt: null,
            onCooldown: false,
            cooldownEndsAt: null,
          },
        };
      }

      // Check if the domain was refreshed within the last 24 hours
      // Use type assertion with interface that includes the new field
      const domainWithRefresh = existingDomain as PrismaDomain & {
        lastRefreshedAt?: Date | null;
      };

      if (!forceRefresh && domainWithRefresh.lastRefreshedAt) {
        const lastRefreshed = new Date(domainWithRefresh.lastRefreshedAt);
        // Use shorter cooldown if there's no WHOIS response or if the last attempt failed
        const hasSuccessfulWhoisResponse = domainWithRefresh.response &&
          Object.keys(domainWithRefresh.response).length > 0 &&
          typeof domainWithRefresh.response === 'object' &&
          !('error' in domainWithRefresh.response);
        const cooldownPeriod = hasSuccessfulWhoisResponse
          ? 24 * 60 * 60 * 1000 // 24 hours in milliseconds for domains with successful WHOIS data
          : 5 * 1000; // 5 seconds for domains without data or with errors
        const cooldownEnds = new Date(lastRefreshed.getTime() + cooldownPeriod);
        const now = new Date();

        if (now < cooldownEnds) {
          // Calculate time remaining in the cooldown period
          const timeRemaining = cooldownEnds.getTime() - now.getTime();
          const hasWhoisResponse = domainWithRefresh.response && Object.keys(domainWithRefresh.response).length > 0;

          let timeMessage: string;
          if (hasWhoisResponse) {
            const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));
            timeMessage = `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}`;
          } else {
            const secondsRemaining = Math.ceil(timeRemaining / 1000);
            timeMessage = `${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'}`;
          }

          // Create serialized domain with cooldown information
          const serializedDomain = serializeDomain(
            domainWithRefresh as PrismaDomain
          );
          serializedDomain.onCooldown = true;
          serializedDomain.cooldownEndsAt = cooldownEnds;

          // Return a structured response instead of throwing an error
          return {
            success: false,
            onCooldown: true,
            timeRemaining,
            message: `Domain refresh on cooldown. Please try again in ${timeMessage}.`,
            domain: serializedDomain,
          } as DomainLookupResponse;
        }
      }

      // 5. Get WHOIS information for the domain
      let whoisInfo;
      try {
        whoisInfo = await this.getDetailedWhoisInfo(existingDomain.name);
      } catch (error) {
        console.error(
          `Error fetching WHOIS data for ${existingDomain.name}:`,
          error
        );
        return {
          success: false,
          message: `Failed to fetch WHOIS data: ${error instanceof Error ? error.message : "Unknown error"
            }`,
          domain: serializeDomain(existingDomain),
        };
      }

      // Check if domain is registered based on WHOIS response
      const isRegistered = whoisInfo.status === true || whoisInfo.domain_registered === 'yes';
      if (!isRegistered) {
        // Update domain with registration status only
        try {
          const domain = await prisma.domain.update({
            where: { id: BigInt(domainId) },
            data: {
              lastRefreshedAt: new Date(),
              response: whoisInfo,
              registrar: null,
              emails: null
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
            message: `Failed to update domain status: ${error instanceof Error ? error.message : "Unknown error"
              }`,
            domain: serializeDomain(existingDomain),
          };
        }
      }

      // Extract registry data and registrar information
      const registryData = whoisInfo.registry_data || ({} as WhoisRegistryData);
      const registrar = registryData.domain_registrar || ({} as WhoisRegistrar);

      // Helper function to get the first valid date from multiple possible fields
      const getFirstValidDate = (...dateStrings: (string | number | boolean | object | null | undefined)[]) => {
        for (const dateStr of dateStrings) {
          if (!dateStr) continue;

          let dateValue: string;
          if (typeof dateStr === 'string') {
            dateValue = dateStr;
          } else if (typeof dateStr === 'number') {
            dateValue = dateStr.toString();
          } else if (dateStr && typeof dateStr === 'object' && 'toString' in dateStr) {
            dateValue = dateStr.toString();
          } else {
            continue;
          }

          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              return date;
            }
          } catch {
            // Skip invalid date strings
            continue;
          }
        }
        return null;
      };

      // Prepare update data with correct types
      const updateData = {
        // Store the complete response
        response: whoisInfo,

        // Registrar information
        registrar: registrar.registrar_name || undefined,

        // Email information
        emails: registrar.email || undefined,

        // Dates - check all possible date fields
        domainCreatedDate: getFirstValidDate(
          registryData.create_date,
          whoisInfo.create_date,
          whoisInfo.creation_date
        ),
        domainUpdatedDate: getFirstValidDate(
          registryData.update_date,
          whoisInfo.update_date,
          whoisInfo.updated_date
        ),
        domainExpiryDate: getFirstValidDate(
          // Check registry data first
          registryData.expiry_date,
          // Check root level WHOIS response
          whoisInfo.expiry_date,
          whoisInfo.expiration_date,
          whoisInfo.expire_date,
          // Check if there's an expiry date in the stored response
          typeof whoisInfo.response === 'object' && whoisInfo.response
            ? (
              (whoisInfo.response as WhoisDateFields).expiry_date ||
              (whoisInfo.response as WhoisDateFields).expiration_date ||
              (whoisInfo.response as WhoisDateFields).expire_date
            )
            : undefined
        ),

        // Update refresh timestamp
        lastRefreshedAt: new Date(),
      };

      // Update domain information in the database with normalized data
      const updatedDomain = await prisma.domain.update({
        where: { id: BigInt(domainId) },
        data: updateData,
      });

      return {
        success: true,
        domain: serializeDomain(updatedDomain),
      };
    } catch (error) {
      console.error(`Error updating domain info for ID ${domainId}:`, error);
      // Return a structured error response instead of throwing
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (!existingDomain) {
        return {
          success: false,
          message: `Failed to update domain information: ${errorMessage}`,
          domain: {
            id: domainId,
            name: 'Unknown',
            response: {},
            registrar: null,
            emails: null,
            domainExpiryDate: null,
            domainCreatedDate: null,
            domainUpdatedDate: null,
            createdAt: new Date(),
            updatedAt: null,
            lastRefreshedAt: null,
            onCooldown: false,
            cooldownEndsAt: null,
          }
        };
      }
      return {
        success: false,
        message: `Failed to update domain information: ${errorMessage}`,
        domain: serializeDomain(existingDomain),
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
        // Add index hint for performance
        take: 3, // Reduce batch size to avoid rate limits
        orderBy: {
          lastRefreshedAt: 'asc', // Update oldest first
        },
      });

      // No domains to update
      if (domains.length === 0) {
        return 0;
      }

      // Process domains in parallel with rate limiting
      const results = await Promise.allSettled(
        domains.map(async (domain) => {
          try {
            await this.updateDomainInfo(domain.id.toString(), true);
            return true;
          } catch (error) {
            console.error(
              `Error updating domain ${domain.name}:`,
              error instanceof Error ? error.message : error
            );
            return false;
          }
        })
      );

      // Count successful updates
      const updatedCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value === true
      ).length;

      return updatedCount;
    } catch (error) {
      console.error(`Error batch updating domains for user ${userId}:`, error);
      throw error;
    }
  }
}
