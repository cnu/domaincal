import { Domain as PrismaDomain } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import { DomainValidationService } from "@/services/domain-validation.service";

export interface DomainModel {
  id: string;
  name: string;
  whoisResponse: JsonValue;
  registrar: string | null;
  emails: string | null;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  lastRefreshedAt: Date | null;
}

export interface DomainResponse {
  id: string;
  name: string;
  whoisResponse: JsonValue;
  registrar: string | null;
  emails: string | null;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
  lastRefreshedAt: Date | null;
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
  // Calculate cooldown status
  let onCooldown = false;
  let cooldownEndsAt = null;
  
  if (domain.lastRefreshedAt) {
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const cooldownEndsTime = new Date(domain.lastRefreshedAt.getTime() + cooldownPeriod);
    const now = new Date();
    
    if (now < cooldownEndsTime) {
      onCooldown = true;
      cooldownEndsAt = cooldownEndsTime;
    }
  }
  
  return {
    id: domain.id.toString(),
    name: domain.name,
    whoisResponse: domain.whoisResponse || {},
    registrar: domain.registrar || null,
    emails: domain.emails || null,
    domainExpiryDate: domain.domainExpiryDate || null,
    domainCreatedDate: domain.domainCreatedDate || null,
    domainUpdatedDate: domain.domainUpdatedDate || null,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt || null,
    lastRefreshedAt: domain.lastRefreshedAt || null,
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
