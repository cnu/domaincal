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
      select: {
        id: true,
        name: true,
        whoisResponse: true,
        registrar: true,
        emails: true,
        domainExpiryDate: true,
        domainCreatedDate: true,
        domainUpdatedDate: true,
        createdAt: true,
        updatedAt: true,
        lastRefreshedAt: true,
        users: true,
      },
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
      select: {
        id: true,
        name: true,
        whoisResponse: true,
        registrar: true,
        emails: true,
        domainExpiryDate: true,
        domainCreatedDate: true,
        domainUpdatedDate: true,
        createdAt: true,
        updatedAt: true,
        lastRefreshedAt: true,
        users: true,
      },
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
    const userDomain = await prisma.userDomain.findUnique({
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
        id: BigInt(0),
        name: domainName,
        whoisResponse: {},
        registrar: null,
        emails: null,
        domainExpiryDate: null,
        domainCreatedDate: null,
        domainUpdatedDate: null,
        lastRefreshedAt: null,
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
      ? await prisma.userDomain.findUnique({
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
          whoisResponse: {},
          registrar: null,
          emails: null,
          domainExpiryDate: null,
          domainCreatedDate: null,
          domainUpdatedDate: new Date(),
          lastRefreshedAt: null,
          users: {
            create: {
              userId: BigInt(userId),
            },
          },
        },
        select: {
          id: true,
          name: true,
          whoisResponse: true,
          registrar: true,
          emails: true,
          domainExpiryDate: true,
          domainCreatedDate: true,
          domainUpdatedDate: true,
          createdAt: true,
          updatedAt: true,
          lastRefreshedAt: true,
          users: true,
        },
      });
      domainId = newDomain.id;

      // Then, fetch WHOIS data in the background
      // This won't block the domain addition process
      this.fetchWhoisDataInBackground(domainId, sanitizedDomain);
    } else {
      domainId = existingDomain.id;
    }

    // Return domain data
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error("Failed to retrieve domain after adding");
    }

    return serializeDomain(domain);
  }

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
      await prisma.userDomain.delete({
        where: {
          userId_domainId: {
            userId: BigInt(userId),
            domainId: BigInt(domainId),
          },
        },
      });

      // Check if any other users are tracking this domain
      const otherUserTracking = await prisma.userDomain.findFirst({
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

      // Get WHOIS information
      const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
        domain.name
      );
      const isRegistered =
        whoisInfo.status === true || whoisInfo.domain_registered === "yes";

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

      // Extract registrar information
      const registrarInfo =
        typeof whoisInfo.domain_registrar === "object" &&
        whoisInfo.domain_registrar !== null
          ? (whoisInfo.domain_registrar as WhoisRegistrar)
          : {};
      const registrarName = registrarInfo.registrar_name || null;

      // Log the data we're about to save
      console.log(`Updating domain ${domainName} with WHOIS data:`, {
        domainRegistered: isRegistered,
        domainCreatedDate,
        domainExpiryDate,
        registrarName,
      });

      // Update domain in database
      const updatedDomain = await prisma.domain.update({
        where: { id: domainId },
        data: {
          whoisResponse: whoisInfo || {},
          registrar: registrarName,
          emails: null,
          domainCreatedDate,
          domainExpiryDate,
          domainUpdatedDate: new Date(),
          lastRefreshedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          whoisResponse: true,
          registrar: true,
          emails: true,
          domainExpiryDate: true,
          domainCreatedDate: true,
          domainUpdatedDate: true,
          createdAt: true,
          updatedAt: true,
          lastRefreshedAt: true,
          users: true,
        },
      });

      console.log(`Successfully updated WHOIS data for ${domainName}:`, {
        id: updatedDomain.id,
        name: updatedDomain.name,
        domainCreatedDate: updatedDomain.domainCreatedDate,
        domainExpiryDate: updatedDomain.domainExpiryDate,
        whoisResponse: updatedDomain.whoisResponse,
      });
    } catch (error) {
      console.error(`Error fetching WHOIS data for ${domainName}:`, error);
      // Update domain with error status
      try {
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainUpdatedDate: new Date(),
            lastRefreshedAt: new Date(),
            whoisResponse: {
              error: error instanceof Error ? error.message : "Unknown error",
            },
          },
        });
      } catch (dbError) {
        console.error(
          `Error updating domain ${domainName} with error state:`,
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
          ? await prisma.userDomain.findUnique({
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
