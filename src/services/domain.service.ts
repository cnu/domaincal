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
        domainCreatedDate: null,
        registrar: null,
        emails: null,
        response: null,
        createdAt: new Date(),
        updatedAt: null,
      };
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
      return {
        id: existingDomain.id.toString(),
        name: existingDomain.name,
        domainExpiryDate: existingDomain.domainExpiryDate,
        domainCreatedDate: existingDomain.domainCreatedDate,
        registrar: existingDomain.registrar,
        emails: existingDomain.emails,
        response: existingDomain.response,
        createdAt: existingDomain.createdAt,
        updatedAt: existingDomain.updatedAt,
      };
    }

    let domainId: bigint;

    if (!existingDomain) {
      try {
        // Check domain registration status with WHOIS API
        const checkResult = await DomainLookupService.checkDomainRegistration(
          sanitizedDomain
        );

        if (checkResult.result === "registered") {
          // Get detailed WHOIS information
          const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
            sanitizedDomain
          );

          // Parse dates from WHOIS response - handle different field names with better parsing
          // The WHOIS API returns data in a nested structure that's already handled by domain-lookup.service.ts
          let expiryDate = null;
          try {
            if (whoisInfo.expiration_date) {
              expiryDate = new Date(whoisInfo.expiration_date);
              console.log(`Parsed expiration_date: ${whoisInfo.expiration_date} -> ${expiryDate}`);
            } else if (whoisInfo.expire_date) {
              expiryDate = new Date(whoisInfo.expire_date);
              console.log(`Parsed expire_date: ${whoisInfo.expire_date} -> ${expiryDate}`);
            }
            
            // Check if the date is valid
            if (expiryDate && isNaN(expiryDate.getTime())) {
              console.log(`Invalid expiry date detected, setting to null`);
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
              console.log(`Parsed creation_date: ${whoisInfo.creation_date} -> ${createdDate}`);
            } else if (whoisInfo.create_date) {
              createdDate = new Date(whoisInfo.create_date);
              console.log(`Parsed create_date: ${whoisInfo.create_date} -> ${createdDate}`);
            }
            
            // Check if the date is valid
            if (createdDate && isNaN(createdDate.getTime())) {
              console.log(`Invalid creation date detected, setting to null`);
              createdDate = null;
            }
          } catch (error) {
            console.error(`Error parsing creation date:`, error);
            createdDate = null;
          }
          
          // Log the full domain data for debugging
          console.log(`Domain data for ${sanitizedDomain}:`, {
            expiryDate,
            createdDate,
            whoisInfo: JSON.stringify(whoisInfo).substring(0, 200) + '...'
          });

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

          // Create new domain with WHOIS data
          const newDomain = await prisma.domain.create({
            data: {
              name: sanitizedDomain,
              domainExpiryDate: expiryDate,
              domainCreatedDate: createdDate,
              domainUpdatedDate: new Date(),
              registrar,
              emails,
              response: JSON.parse(JSON.stringify(whoisInfo)),
            },
          });
          domainId = newDomain.id;
        } else {
          // Create new domain with just the status information
          const newDomain = await prisma.domain.create({
            data: {
              name: sanitizedDomain,
              domainUpdatedDate: new Date(),
              response: { status: checkResult.result },
            },
          });
          domainId = newDomain.id;
        }
      } catch (error) {
        console.error(
          `Error fetching WHOIS data for ${sanitizedDomain}:`,
          error
        );
        // Create domain without WHOIS data if API call fails
        const newDomain = await prisma.domain.create({
          data: { name: sanitizedDomain },
        });
        domainId = newDomain.id;
      }
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

        let domainId: bigint;

        if (!existingDomain) {
          try {
            // Check domain registration status with WHOIS API
            const checkResult =
              await DomainLookupService.checkDomainRegistration(domain);

            if (checkResult.result === "registered") {
              // Get detailed WHOIS information
              const whoisInfo = await DomainLookupService.getDetailedWhoisInfo(
                domain
              );

              // Parse dates from WHOIS response - handle different field names with better parsing
              let expiryDate = null;
              try {
                if (whoisInfo.expiration_date) {
                  expiryDate = new Date(whoisInfo.expiration_date);
                  console.log(`Bulk: Parsed expiration_date: ${whoisInfo.expiration_date} -> ${expiryDate}`);
                } else if (whoisInfo.expire_date) {
                  expiryDate = new Date(whoisInfo.expire_date);
                  console.log(`Bulk: Parsed expire_date: ${whoisInfo.expire_date} -> ${expiryDate}`);
                }
                
                // Check if the date is valid
                if (expiryDate && isNaN(expiryDate.getTime())) {
                  console.log(`Bulk: Invalid expiry date detected, setting to null`);
                  expiryDate = null;
                }
              } catch (error) {
                console.error(`Bulk: Error parsing expiry date:`, error);
                expiryDate = null;
              }
                  
              let createdDate = null;
              try {
                if (whoisInfo.creation_date) {
                  createdDate = new Date(whoisInfo.creation_date);
                  console.log(`Bulk: Parsed creation_date: ${whoisInfo.creation_date} -> ${createdDate}`);
                } else if (whoisInfo.create_date) {
                  createdDate = new Date(whoisInfo.create_date);
                  console.log(`Bulk: Parsed create_date: ${whoisInfo.create_date} -> ${createdDate}`);
                }
                
                // Check if the date is valid
                if (createdDate && isNaN(createdDate.getTime())) {
                  console.log(`Bulk: Invalid creation date detected, setting to null`);
                  createdDate = null;
                }
              } catch (error) {
                console.error(`Bulk: Error parsing creation date:`, error);
                createdDate = null;
              }
              
              // Log the full domain data for debugging
              console.log(`Bulk: Domain data for ${domain}:`, {
                expiryDate,
                createdDate,
                whoisInfo: JSON.stringify(whoisInfo).substring(0, 200) + '...'
              });

              // Extract registrar information - handle different formats
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

              // Extract email information - handle different formats
              const emails =
                (whoisInfo.registrant &&
                  "email" in whoisInfo.registrant &&
                  whoisInfo.registrant.email) ||
                (whoisInfo.registrar &&
                  typeof whoisInfo.registrar !== "string" &&
                  whoisInfo.registrar.email) ||
                whoisInfo.emails ||
                null;

              // Create new domain with WHOIS data
              const newDomain = await prisma.domain.create({
                data: {
                  name: domain,
                  domainExpiryDate: expiryDate,
                  domainCreatedDate: createdDate,
                  domainUpdatedDate: new Date(),
                  registrar,
                  emails,
                  response: JSON.parse(JSON.stringify(whoisInfo)),
                },
              });
              domainId = newDomain.id;
            } else {
              // Create new domain with just the status information
              const newDomain = await prisma.domain.create({
                data: {
                  name: domain,
                  domainUpdatedDate: new Date(),
                  response: { status: checkResult.result },
                },
              });
              domainId = newDomain.id;
            }
          } catch (error) {
            console.error(`Error fetching WHOIS data for ${domain}:`, error);
            // Create domain without WHOIS data if API call fails
            const newDomain = await prisma.domain.create({
              data: { name: domain },
            });
            domainId = newDomain.id;
          }
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
