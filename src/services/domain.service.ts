import { prisma } from "@/lib/prisma";
import {
  DomainResponse,
  serializeDomain,
  validateDomain,
  sanitizeDomain,
  processDomainList,
} from "@/models/domain.model";
import { DomainLookupService } from "@/services/domain-lookup.service";

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
        domainExpiryDate: null,
        domainCreatedDate: null,
        domainUpdatedDate: null,
        lastRefreshedAt: null,
        registrar: null,
        emails: null,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(), // Use new Date() instead of null
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
  static async fetchWhoisDataInBackground(
    domainId: bigint,
    domainName: string
  ): Promise<void> {
    try {
      console.log(`Fetching WHOIS data in background for ${domainName}`);

      // Add a small delay to ensure the UI has time to render the new domain
      // This makes the user experience smoother
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check domain registration status with WHOIS API
      const checkResult = await DomainLookupService.checkDomainRegistration(
        domainName
      );

      if (checkResult.result === "registered") {
        // Get detailed WHOIS information
        const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
          domainName
        );

        // Parse dates from WHOIS response - handle different field names with better parsing
        let expiryDate = null;
        try {
          if (whoisInfo.expiration_date) {
            expiryDate = new Date(whoisInfo.expiration_date);
          } else if (whoisInfo.expire_date) {
            expiryDate = new Date(whoisInfo.expire_date);
          }

          // Check if the date is valid
          if (expiryDate && isNaN(expiryDate.getTime())) {
            expiryDate = null;
          }
        } catch (error) {
          console.error(`Error parsing expiry date:`, error);
          expiryDate = null;
        }

        let createdDate = null;
        try {
          if (whoisInfo.creation_date) {
            createdDate = new Date(whoisInfo.creation_date);
          } else if (whoisInfo.create_date) {
            createdDate = new Date(whoisInfo.create_date);
          }

          // Check if the date is valid
          if (createdDate && isNaN(createdDate.getTime())) {
            createdDate = null;
          }
        } catch (error) {
          console.error(`Error parsing creation date:`, error);
          createdDate = null;
        }

        // Extract registrar and contact information
        const registrarValue = whoisInfo.registrar || null;
        // Convert registrar to string format if it's an object
        const registrar =
          typeof registrarValue === "string"
            ? registrarValue
            : registrarValue &&
              typeof registrarValue === "object" &&
              registrarValue.name
            ? registrarValue.name
            : null;

        const emails =
          (whoisInfo.registrant &&
            "email" in whoisInfo.registrant &&
            whoisInfo.registrant.email) ||
          (whoisInfo.registrar &&
            typeof whoisInfo.registrar !== "string" &&
            whoisInfo.registrar.email) ||
          whoisInfo.emails ||
          null;

        // Update the domain with WHOIS data
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainExpiryDate: expiryDate,
            domainCreatedDate: createdDate,
            domainUpdatedDate: new Date(),
            registrar,
            emails,
            response: JSON.parse(JSON.stringify(whoisInfo)),
          },
        });

        console.log(`Successfully updated WHOIS data for ${domainName}`);
      } else {
        // Update domain with just the status information
        await prisma.domain.update({
          where: { id: domainId },
          data: {
            domainUpdatedDate: new Date(),
            response: { status: checkResult.result },
          },
        });

        console.log(`Domain ${domainName} is not registered`);
      }
    } catch (error) {
      console.error(`Error fetching WHOIS data for ${domainName}:`, error);
      // We don't throw the error here since this is a background process
      // and we don't want to affect the user experience
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
