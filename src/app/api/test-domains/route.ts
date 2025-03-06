import { NextResponse } from "next/server";
import { DomainValidationService } from "../../../services/domain-validation.service";

export async function GET() {
  // Test valid domains
  const validDomains = [
    "example.com",
    "www.example.com",
    "blog.example.co.uk",
    "m.example.org",
    "sub.domain.example.net",
  ];

  // Test invalid domains
  const invalidDomains = [
    "not-a-domain",
    "example",
    ".com",
    "http:/example.com",
    "example.com/",
    "example..com",
    "example.com..",
  ];

  const results = {
    validDomainTests: validDomains.map((domain) => ({
      domain,
      isValid: DomainValidationService.validateDomain(domain),
      sanitized: DomainValidationService.sanitizeDomain(domain),
    })),
    invalidDomainTests: invalidDomains.map((domain) => ({
      domain,
      isValid: DomainValidationService.validateDomain(domain),
      sanitized: DomainValidationService.sanitizeDomain(domain),
    })),
    batchProcessing: DomainValidationService.processDomainList([
      ...validDomains,
      ...invalidDomains,
    ]),
  };

  return NextResponse.json(results);
}
