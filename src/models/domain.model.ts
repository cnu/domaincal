import { Domain as PrismaDomain } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import { DomainValidationService } from "@/services/domain-validation.service";

export interface DomainModel {
  id: string;
  name: string;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
  lastRefreshedAt: Date | null;
  registrar: string | null;
  emails: string | null;
  response: JsonValue | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface DomainResponse {
  id: string;
  name: string;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
  lastRefreshedAt: Date | null;
  registrar: string | null;
  emails: string | null;
  response: JsonValue | null;
  createdAt: Date;
  updatedAt: Date | null;
  onCooldown?: boolean;
  cooldownEndsAt?: Date | null;
}

export interface DomainLookupResponse {
  success: boolean;
  onCooldown?: boolean;
  hoursRemaining?: number;
  message?: string;
  domain: DomainResponse;
}

export const serializeDomain = (domain: PrismaDomain): DomainResponse => {
  // Extract lastRefreshedAt with proper type handling
  const extendedDomain = domain as PrismaDomain & { lastRefreshedAt?: Date | null };
  const lastRefreshedAt = extendedDomain.lastRefreshedAt || null;
  
  // Calculate cooldown status
  let onCooldown = false;
  let cooldownEndsAt = null;
  
  if (lastRefreshedAt) {
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const cooldownEndsTime = new Date(new Date(lastRefreshedAt).getTime() + cooldownPeriod);
    const now = new Date();
    
    if (now < cooldownEndsTime) {
      onCooldown = true;
      cooldownEndsAt = cooldownEndsTime;
    }
  }
  
  return {
    id: domain.id.toString(),
    name: domain.name,
    domainExpiryDate: domain.domainExpiryDate,
    domainCreatedDate: domain.domainCreatedDate,
    domainUpdatedDate: domain.domainUpdatedDate,
    lastRefreshedAt,
    registrar: domain.registrar,
    emails: domain.emails,
    response: domain.response,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    onCooldown,
    cooldownEndsAt,
  };
};

export const validateDomain = (domain: string): boolean => {
  return DomainValidationService.validateDomain(domain);
};

export const sanitizeDomain = (domain: string): string | null => {
  return DomainValidationService.sanitizeDomain(domain);
};

export const processDomainList = (domains: string[]): {
  validDomains: string[];
  invalidDomains: string[];
  duplicates: string[];
} => {
  return DomainValidationService.processDomainList(domains);
};
