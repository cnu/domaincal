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

interface WhoisQueryResponse {
  // Basic domain info
  domain_name?: string;
  status?: boolean;
  query_time?: string;
  whois_server?: string;
  domain_registered?: string;

  // Dates
  creation_date?: string;
  create_date?: string;
  updated_date?: string;
  update_date?: string;
  expiration_date?: string;
  expire_date?: string;
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
      const apiUrl = `${this.API_BASE_URL}/whois?whois=live&domainName=${domainName}&apiKey=${this.API_KEY}`;
      console.log('Making WHOIS API request for domain:', domainName);
      console.log('API URL:', apiUrl);

      // Make the API call
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        } as HeadersInit,
        redirect: "follow",
      });

      console.log(
        `WHOIS API Response for ${domainName}:`,
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      );

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
      console.log(
        `WHOIS API data for ${domainName}:`,
        JSON.stringify(whoisData, null, 2)
      );

      if (!whoisData || typeof whoisData !== 'object') {
        throw new Error(`Invalid WHOIS API response for ${domainName}: ${JSON.stringify(whoisData)}`);
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

      // Extract registrar info
      const registrarInfo = whoisData.domain_registrar || {};

      // Create normalized response
      const normalizedResponse: WhoisQueryResponse = {
        domain_name: whoisData.domain_name,
        status: whoisData.status === true || whoisData.domain_registered === true || whoisData.domain_registered === "yes",
        query_time: whoisData.query_time,
        whois_server: whoisData.whois_server,
        domain_registered: (whoisData.status === true || whoisData.domain_registered === true || whoisData.domain_registered === "yes") ? "yes" : "no",
        create_date: parseDate(whoisData.create_date)?.toISOString(),
        update_date: parseDate(whoisData.update_date)?.toISOString(),
        expiry_date: parseDate(whoisData.expiry_date)?.toISOString(),
        domain_registrar: {
          iana_id: registrarInfo.iana_id,
          registrar_name: registrarInfo.registrar_name,
          whois_server: registrarInfo.whois_server,
          website_url: registrarInfo.website_url,
          email: registrarInfo.email,
        },
        name_servers: Array.isArray(whoisData.name_servers)
          ? whoisData.name_servers.filter(Boolean)
          : [],
        domain_status: Array.isArray(whoisData.domain_status)
          ? whoisData.domain_status
          : [],
        whois_raw_domain: whoisData.whois_raw_domain,
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

      // 3. Fetch the domain to ensure it exists and check refresh cooldown
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
          const serializedDomain = serializeDomain(
            domainWithRefresh as PrismaDomain
          );
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
          message: `Failed to fetch WHOIS data: ${
            error instanceof Error ? error.message : "Unknown error"
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
              domainRegistered: false,
              lastRefreshedAt: new Date(),
              response: whoisInfo,
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

      // Extract registry data and registrar information
      const registryData = whoisInfo.registry_data || ({} as WhoisRegistryData);
      const registrar = registryData.domain_registrar || ({} as WhoisRegistrar);

      // Prepare update data with correct types
      const updateData = {
        // Store the complete response
        response: whoisInfo,

        // Basic domain info
        domainRegistered: 
            (typeof whoisInfo.status === "boolean" && whoisInfo.status === true) || 
            (typeof whoisInfo.domain_registered === "boolean" && whoisInfo.domain_registered === true) || 
            (registryData.domain_registered !== undefined && (
              (typeof registryData.domain_registered === "string" && registryData.domain_registered.toLowerCase() === "yes") || 
              (typeof registryData.domain_registered === "boolean" && registryData.domain_registered === true)
            )),
        whoisServer: registryData.whois_server || whoisInfo.whois_server || null,
        queryTime: registryData.query_time
          ? new Date(registryData.query_time)
          : whoisInfo.query_time
          ? new Date(whoisInfo.query_time)
          : null,

        // Dates
        domainCreatedDate: registryData.create_date
          ? new Date(registryData.create_date)
          : null,
        domainUpdatedDate: registryData.update_date
          ? new Date(registryData.update_date)
          : null,
        domainExpiryDate: registryData.expiry_date
          ? new Date(registryData.expiry_date)
          : null,

        // Registrar information
        registrarIanaId: registrar.iana_id || null,
        registrarName: registrar.registrar_name || null,
        registrarWhoisServer: registrar.whois_server || null,
        registrarUrl: registrar.website_url || null,

        // Domain status and servers
        nameServers: registryData.name_servers || [],
        domainStatuses: registryData.domain_status || [],
        dnssecStatus: registryData.dnssec || null,
        dnssecDsData: registryData.dnssec_ds_data || null,

        // Raw WHOIS data
        whoisRawDomain: whoisInfo.whois_raw_domain || null,
        whoisRawRegistry: registryData.whois_raw_registery || null,

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
