import { prisma } from "@/lib/prisma";
import {
  DomainResponse,
  serializeDomain,
  validateDomain,
  sanitizeDomain,
  processDomainList,
} from "@/models/domain.model";
import {
  DomainLookupService,
  WhoisRegistrar,
} from "@/services/domain-lookup.service";
import { createLogger } from "@/lib/logger";

const logger = createLogger("DomainService");
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
        response: true,
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
        response: true,
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
        domain: true,
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
        response: {},
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
          response: {},
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
          response: true,
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
        logger.error(`Error adding domain ${domain}:`, error);        invalidDomains.push(domain);
      }
    }

    return {
      added,
      invalid: invalidDomains,
      duplicates: [...duplicates, ...dbDuplicates],
    };
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
      logger.info("Attempting to delete domain:", { userId, domainId });

      // First check if the user-domain association exists
      const userDomain = await prisma.userDomain.findUnique({
        where: {
          userId_domainId: {
            userId: BigInt(userId),
            domainId: BigInt(domainId),
          },
        },
      });

      logger.info("Found user domain:", userDomain);

      if (!userDomain) {
        throw new Error("Domain not found or not owned by user");
      }

      // Delete the user-domain association
      await prisma.userDomain.delete({
        where: {
          userId_domainId: {
            userId: BigInt(userId),
            domainId: BigInt(domainId),
          },
        },
      });

      logger.info("Deleted user domain association");
    } catch (error) {
      logger.error(
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
      logger.info(`Queueing WHOIS data fetch for ${domainName}`);

      // Queue the WHOIS lookup by calling the background API
      // Instead of using fetch directly, use the DomainLookupService to directly update the domain
      try {
        // Mark the domain as refreshing
        await prisma.domain.update({
          where: { id: domainId },
          data: { lastRefreshedAt: new Date() },
        });

        // Get the domain details
        const domain = await prisma.domain.findUnique({
          where: { id: domainId },
        });

        if (!domain) {
          throw new Error(`Domain with ID ${domainId} not found`);
        }

        // Get WHOIS info directly using the service
        const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
          domain.name
        );

        // Update domain with WHOIS data
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            response: whoisInfo,
            registrar:
              typeof whoisInfo.domain_registrar === "object" &&
              whoisInfo.domain_registrar !== null
                ? (whoisInfo.domain_registrar as WhoisRegistrar)
                    .registrar_name || null
                : null,
            domainExpiryDate: whoisInfo.expiry_date
              ? new Date(whoisInfo.expiry_date)
              : null,
            domainCreatedDate: whoisInfo.creation_date
              ? new Date(whoisInfo.creation_date)
              : null,
            domainUpdatedDate: whoisInfo.updated_date
              ? new Date(whoisInfo.updated_date)
              : null,
          },
        });

        logger.info(`Successfully processed WHOIS lookup for ${domainName}`);
        return;
      } catch (directError) {
        logger.error(`Error in direct WHOIS processing:`, directError);        // Update domain with error status
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            response: {
              error:
                directError instanceof Error
                  ? directError.message
                  : "Unknown error processing WHOIS data",
            },
          },
        });
        return;
      }
    } catch (error) {
      logger.error(`Error queueing WHOIS lookup for ${domainName}:`, error);
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
        logger.error(
          `Error updating domain ${domainName} with error state:`,
          dbError
        );
      }
    }
  }
}
