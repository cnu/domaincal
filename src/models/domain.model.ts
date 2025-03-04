import { Domain as PrismaDomain } from "@prisma/client";
import { JsonValue } from "@prisma/client/runtime/library";

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
  if (!domain || domain.includes(" ") || !domain.includes(".")) return false;

  try {
    // Basic URL validation
    new URL(`http://${domain}`);
    return true;
  } catch {
    return false;
  }
};
