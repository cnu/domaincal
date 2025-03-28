import { prisma } from "@/lib/prisma";
import {
  DomainResponse,
  serializeDomain,
  validateDomain,
  sanitizeDomain,
  processDomainList,
} from "@/models/domain.model";
import { DomainLookupService } from "@/services/domain-lookup.service";
import type { WhoisRegistrar } from "@/services/domain-lookup.service";

export class DomainService {
  /**
   * Get all domains for a user
   */
  static async getUserDomains(userId: string): Promise<DomainResponse[]> {
    const domains = await prisma.domain.findMany({
      where: {
        users: {
          some: {
            userId: BigInt(userId),
          },
        },
      },
      orderBy: [
        // Sort by expiry date ascending (closest expiry dates first, nulls last)
        { domainExpiryDate: "asc" },
        // Secondary sort by name for domains with no expiry date
        { name: "asc" },
      ],
    });

    return domains.map(serializeDomain);
  }

  /**
   * Get paginated domains for a user
   * @param userId User ID
   * @param page Page number (1-based)
   * @param limit Number of items per page
   * @returns Paginated domains with metadata
   */
  static async getPaginatedDomains(
    userId: string,
    page: number,
    limit: number
  ): Promise<{
    domains: DomainResponse[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 10; // Cap at 50 items per page

    // Calculate skip for pagination
    const skip = (validPage - 1) * validLimit;

    // Get total count for pagination metadata
    const totalDomains = await prisma.domain.count({
      where: {
        users: {
          some: {
            userId: BigInt(userId),
          },
        },
      },
    });
    // Get paginated domains
    const domains = await prisma.domain.findMany({
      where: {
        users: {
          some: {
            userId: BigInt(userId),
          },
        },
      },
      orderBy: [
        // Sort by expiry date ascending (closest expiry dates first, nulls last)
        { domainExpiryDate: "asc" },
        // Secondary sort by name for domains with no expiry date
        { name: "asc" },
      ],
      skip,
      take: validLimit,
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalDomains / validLimit);

    return {
      domains: domains.map(serializeDomain),
      page: validPage,
      limit: validLimit,
      total: totalDomains,
      totalPages,
    };
  }

  /**
   * Check if a user owns a specific domain
   * @param userId User ID
   * @param domainId Domain ID
   * @returns True if the user owns the domain, false otherwise
   */
  static async checkUserOwnsDomain(
    userId: string,
    domainId: string
  ): Promise<boolean> {
    const userDomain = await prisma.userDomains.findUnique({
      where: {
        userId_domainId: {
          userId: BigInt(userId),
          domainId: BigInt(domainId),
        },
      },
      include: {
        domain: true, // Include domain details for validation
      },
    });

    return !!userDomain && !!userDomain.domain;
  }

  /**
   * Add a domain for a user
   */
  static async addDomainForUser(
    userId: string,
    domainName: string
  ): Promise<DomainResponse> {
    // Sanitize and validate domain
    const sanitizedDomain = sanitizeDomain(domainName);
    if (!sanitizedDomain || !validateDomain(sanitizedDomain)) {
      // Create a mock domain object that matches the Prisma schema
      const mockDomain = {
        id: BigInt(0), // Use BigInt(0) instead of empty string
        name: domainName,
        domainRegistered: false,
        whoisServer: null,
        queryTime: null,
        domainExpiryDate: null,
        domainCreatedDate: null,
        domainUpdatedDate: null,
        lastRefreshedAt: null,
        registrarIanaId: null,
        registrarName: null,
        registrarWhoisServer: null,
        registrarUrl: null,
        nameServers: [],
        domainStatuses: [],
        dnssecStatus: null,
        dnssecDsData: null,
        whoisRawDomain: null,
        whoisRawRegistry: null,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Return a serialized domain with error indication
      return serializeDomain(mockDomain);
    }

    // Check if domain already exists
    const existingDomain = await prisma.domain.findUnique({
      where: { name: sanitizedDomain },
    });

    // Check if user already has this domain
    const existingUserDomain = existingDomain
      ? await prisma.userDomains.findUnique({
          where: {
            userId_domainId: {
              userId: BigInt(userId),
              domainId: existingDomain.id,
            },
          },
        })
      : null;

    // If user already has this domain, return it as a duplicate
    if (existingUserDomain && existingDomain) {
      return serializeDomain(existingDomain);
    }

    let domainId: bigint;

    if (!existingDomain) {
      // First, create the domain with minimal information
      // This ensures the domain is added quickly without waiting for API calls
      // domainExpiryDate is explicitly set to null to show '...' in the UI
      const newDomain = await prisma.domain.create({
        data: {
          name: sanitizedDomain,
          domainExpiryDate: null,
          domainUpdatedDate: new Date(),
        },
      });
      domainId = newDomain.id;

      // Then, fetch WHOIS data in the background
      // This won't block the domain addition process
      this.fetchWhoisDataInBackground(domainId, sanitizedDomain);
    } else {
      domainId = existingDomain.id;
    }

    // Link domain to user
    await prisma.userDomains.upsert({
      where: {
        userId_domainId: {
          userId: BigInt(userId),
          domainId,
        },
      },
      create: {
        userId: BigInt(userId),
        domainId,
      },
      update: {}, // No updates needed if association exists
    });

    // Return domain data
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error("Failed to retrieve domain after adding");
    }

    return serializeDomain(domain);
  }

  // These methods were removed as they're duplicative of the functions in domain.model.ts

  /**
   * Fetch WHOIS data for a domain in the background and update the database
   * This method is called after a domain is added to the database
   * @param domainId The ID of the domain in the database
   * @param domainName The domain name to fetch WHOIS data for
   */
  /**
   * Delete a domain for a user
   * @param userId User ID
   * @param domainId Domain ID
   * @returns void
   */
  static async deleteDomainForUser(
    userId: string,
    domainId: string
  ): Promise<void> {
    try {
      // Delete the user-domain association
      await prisma.userDomains.delete({
        where: {
          userId_domainId: {
            userId: BigInt(userId),
            domainId: BigInt(domainId),
          },
        },
      });

      // Check if any other users are tracking this domain
      const otherUserTracking = await prisma.userDomains.findFirst({
        where: {
          domainId: BigInt(domainId),
        },
      });

      // If no other users are tracking this domain, delete it
      if (!otherUserTracking) {
        await prisma.domain.delete({
          where: {
            id: BigInt(domainId),
          },
        });
      }
    } catch (error) {
      console.error(
        `Error deleting domain ${domainId} for user ${userId}:`,
        error
      );
      throw error;
    }
  }

  static async fetchWhoisDataInBackground(
    domainId: bigint,
    domainName: string
  ): Promise<void> {
    try {
      console.log(`Fetching WHOIS data in background for ${domainName}`);

      // Verify WHOIS API configuration
      if (!process.env.WHOIS_API_KEY) {
        console.error("WHOIS_API_KEY environment variable is not set");
        return;
      }

      // Check if domain exists
      const domain = await prisma.domain.findUnique({
        where: { id: domainId },
      });

      if (!domain) {
        console.error(`Domain ${domainId} not found`);
        return;
      }

      // Check domain registration status with WHOIS API
      const checkResult = await DomainLookupService.checkDomainRegistration(
        domainName
      );

      if (!checkResult || !checkResult.result) {
        console.error(
          `Invalid response from WHOIS API for ${domainName}:`,
          checkResult
        );
        return;
      }

      if (checkResult.result === "registered") {
        // Get detailed WHOIS information
        const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
          domainName
        );

        // Helper function to parse date strings
        const parseDate = (dateStr?: string | null): Date | null => {
          if (!dateStr) return null;
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
          } catch {
            return null;
          }
        };

        // Parse dates from WHOIS response
        const domainExpiryDate = parseDate(whoisInfo.expiry_date as string);
        const domainCreatedDate = parseDate(whoisInfo.create_date as string);
        const domainUpdatedDate =
          parseDate(whoisInfo.update_date as string) || new Date();

        // Extract registrar information
        const registrarInfo =
          typeof whoisInfo.domain_registrar === "object" &&
          whoisInfo.domain_registrar !== null
            ? (whoisInfo.domain_registrar as WhoisRegistrar)
            : {};
        const registrar = registrarInfo.registrar_name || null;

        // Log the data we're about to save
        console.log(`Updating domain ${domainName} with WHOIS data:`, {
          domainExpiryDate,
          domainCreatedDate,
          domainUpdatedDate,
          registrar,
          registrarInfo,
          rawResponse: whoisInfo,
        });

        // Update the domain with WHOIS data
        const updatedDomain = await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainExpiryDate,
            domainCreatedDate,
            domainUpdatedDate,
            // Registrar information
            registrarIanaId:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar
                ? (whoisInfo.domain_registrar as WhoisRegistrar).iana_id || null
                : null,
            registrarName:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar
                ? (whoisInfo.domain_registrar as WhoisRegistrar)
                    .registrar_name || null
                : null,
            registrarWhoisServer:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar
                ? (whoisInfo.domain_registrar as WhoisRegistrar).whois_server ||
                  null
                : null,
            registrarUrl:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar
                ? (whoisInfo.domain_registrar as WhoisRegistrar).website_url ||
                  null
                : null,
            response: whoisInfo,
            lastRefreshedAt: new Date(),
          },
        });

        console.log(`Successfully updated WHOIS data for ${domainName}:`, {
          id: updatedDomain.id,
          name: updatedDomain.name,
          domainExpiryDate: updatedDomain.domainExpiryDate,
          domainCreatedDate: updatedDomain.domainCreatedDate,
          domainUpdatedDate: updatedDomain.domainUpdatedDate,
          registrarInfo: {
            name: updatedDomain.registrarName,
            ianaId: updatedDomain.registrarIanaId,
            whoisServer: updatedDomain.registrarWhoisServer,
            url: updatedDomain.registrarUrl,
          },
        });
      } else {
        // Update domain with just the status information
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainUpdatedDate: new Date(),
            lastRefreshedAt: new Date(),

            response: { status: checkResult.result },
          },
        });

        // console.log(`Domain ${domainName} is not registered`);
      }
    } catch (error) {
      console.error(`Error fetching WHOIS data for ${domainName}:`, error);
      // Update domain with error status
      try {
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainUpdatedDate: new Date(),
            lastRefreshedAt: new Date(),

            response: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          },
        });
      } catch (dbError) {
        console.error(
          `Failed to update domain ${domainId} with error status:`,
          dbError
        );
      }
    }
  }

  /**
   * Process multiple domains for a user
   * @param userId User ID
   * @param domainNames Array of domain names
   * @returns Object with results of processing
   */
  static async addMultipleDomainsForUser(
    userId: string,
    domainNames: string[]
  ): Promise<{
    added: DomainResponse[];
    invalid: string[];
    duplicates: string[];
  }> {
    const { validDomains, invalidDomains, duplicates } =
      processDomainList(domainNames);

    const added: DomainResponse[] = [];
    const dbDuplicates: string[] = [];

    // Process each valid domain
    for (const domain of validDomains) {
      try {
        // Check if domain already exists in the database
        const existingDomain = await prisma.domain.findUnique({
          where: { name: domain },
        });

        // Check if user already has this domain
        const existingUserDomain = existingDomain
          ? await prisma.userDomains.findUnique({
              where: {
                userId_domainId: {
                  userId: BigInt(userId),
                  domainId: existingDomain.id,
                },
              },
            })
          : null;

        // If user already has this domain, add it to duplicates
        if (existingUserDomain && existingDomain) {
          dbDuplicates.push(domain);
          continue;
        }

        // Use addDomainForUser to handle the domain addition
        // This reuses the existing logic for adding a single domain
        const addedDomain = await this.addDomainForUser(userId, domain);
        added.push(addedDomain);
      } catch (error) {
        console.error(`Error adding domain ${domain}:`, error);
        invalidDomains.push(domain);
      }
    }

    return {
      added,
      invalid: invalidDomains,
      duplicates: [...duplicates, ...dbDuplicates],
    };
  }
}
