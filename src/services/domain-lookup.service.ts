import { prisma } from "@/lib/prisma";
import { DomainResponse, serializeDomain } from "@/models/domain.model";

/**
 * Service for handling domain lookup operations
 */
export class DomainLookupService {
  /**
   * Update domain information from external sources
   * @param domainId The ID of the domain to update
   * @returns The updated domain information
   */
  static async updateDomainInfo(domainId: string): Promise<DomainResponse> {
    try {
      // Fetch the domain to ensure it exists
      const existingDomain = await prisma.domain.findUnique({
        where: { id: BigInt(domainId) }
      });
      
      if (!existingDomain) {
        throw new Error(`Domain with ID ${domainId} not found`);
      }
      
      // Update the domain with the fetched information
      // In a real implementation, this would call an external API
      const domain = await prisma.domain.update({
        where: { id: BigInt(domainId) },
        data: {
          domainUpdatedDate: new Date(),
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
                lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          ]
        },
        take: 10, // Process in batches of 10 for performance
      });

      // No domains to update
      if (domains.length === 0) {
        return 0;
      }

      // In a real implementation, this would update each domain
      // with information from an external API
      return domains.length;
    } catch (error) {
      console.error(`Error batch updating domains for user ${userId}:`, error);
      throw error;
    }
  }
}
