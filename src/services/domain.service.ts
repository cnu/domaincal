import { prisma } from "@/lib/prisma";
import {
  DomainResponse,
  serializeDomain,
  validateDomain,
  sanitizeDomain,
  processDomainList,
} from "@/models/domain.model";

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
    });

    return domains.map(serializeDomain);
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
      // Return a default DomainResponse object with error indication
      // We use an empty id to indicate an error state that the UI can check for
      return {
        id: "",
        name: domainName,
        domainExpiryDate: null,
        createdAt: new Date(),
        updatedAt: null,
      };
    }

    // Check if domain already exists
    const existingDomain = await prisma.domain.findUnique({
      where: { name: sanitizedDomain },
    });

    let domainId: bigint;
    if (!existingDomain) {
      // Create new domain
      const newDomain = await prisma.domain.create({
        data: { name: sanitizedDomain },
      });
      domainId = newDomain.id;
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

  /**
   * Validate a domain without adding it
   */
  static validateDomainOnly(domainName: string): boolean {
    return validateDomain(domainName.trim());
  }

  /**
   * Sanitize a domain without adding it
   */
  static sanitizeDomainOnly(domainName: string): string | null {
    return sanitizeDomain(domainName);
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

        let domainId: bigint;
        if (!existingDomain) {
          // Create new domain
          const newDomain = await prisma.domain.create({
            data: { name: domain },
          });
          domainId = newDomain.id;
        } else {
          domainId = existingDomain.id;

          // Check if user already has this domain
          const existingUserDomain = await prisma.userDomains.findUnique({
            where: {
              userId_domainId: {
                userId: BigInt(userId),
                domainId,
              },
            },
          });

          if (existingUserDomain) {
            dbDuplicates.push(domain);
            continue;
          }
        }

        // Link domain to user
        await prisma.userDomains.create({
          data: {
            userId: BigInt(userId),
            domainId,
          },
        });

        // Return domain data
        const domainData = await prisma.domain.findUnique({
          where: { id: domainId },
        });

        if (domainData) {
          added.push(serializeDomain(domainData));
        }
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
