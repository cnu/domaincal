import { prisma } from "@/lib/prisma";
import {
  DomainResponse,
  serializeDomain,
  validateDomain,
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
    // Validate domain
    if (!validateDomain(domainName.trim())) {
      throw new Error("Invalid domain format");
    }

    // Check if domain already exists
    const existingDomain = await prisma.domain.findUnique({
      where: { name: domainName },
    });

    let domainId: bigint;
    if (!existingDomain) {
      // Create new domain
      const newDomain = await prisma.domain.create({
        data: { name: domainName },
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
}
