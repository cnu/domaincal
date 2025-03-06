import { Domain as PrismaDomain } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";
import { DomainValidationService } from "@/services/domain-validation.service";

export interface DomainModel {
  id: string;
  name: string;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
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
  createdAt: Date;
  updatedAt: Date | null;
}

export const serializeDomain = (domain: PrismaDomain): DomainResponse => ({
  id: domain.id.toString(),
  name: domain.name,
  domainExpiryDate: domain.domainExpiryDate,
  createdAt: domain.createdAt,
  updatedAt: domain.updatedAt,
});

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
