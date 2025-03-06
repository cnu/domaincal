import * as psl from "psl";
import normalizeUrl from "normalize-url";

/**
 * Common subdomains that should be stripped when extracting the root domain
 */
const COMMON_SUBDOMAINS = [
  "www",
  "m",
  "blog",
  "shop",
  "store",
  "app",
  "mail",
  "support",
  "help",
  "docs",
  "api",
  "dev",
  "staging",
  "test",
  "beta",
  "admin",
  "mobile",
  "web",
  "portal",
  "login",
  "secure",
];

export class DomainValidationService {
  /**
   * Validates and sanitizes a domain name
   * - Strips common subdomains
   * - Uses Public Suffix List to extract the root domain
   * - Validates the domain format
   *
   * @param domain The domain to validate and sanitize
   * @returns The sanitized domain or null if invalid
   */
  static sanitizeDomain(domain: string): string | null {
    if (!domain || typeof domain !== "string") {
      return null;
    }

    // Reject email addresses
    if (domain.includes("@")) {
      return null;
    }

    try {
      // Normalize the domain (trim, lowercase, etc.)
      let normalizedDomain = domain.trim().toLowerCase();

      // Try to normalize the URL format
      try {
        // Add protocol if missing to make normalize-url work properly
        if (!normalizedDomain.includes("://")) {
          normalizedDomain = `http://${normalizedDomain}`;
        }

        // Normalize the URL
        const normalizedUrl = normalizeUrl(normalizedDomain, {
          stripProtocol: true,
          stripWWW: true,
          removeTrailingSlash: true,
          removeQueryParameters: true,
        });

        // Extract hostname from the normalized URL
        normalizedDomain = normalizedUrl;
      } catch (error) {
        // If normalize-url fails, continue with basic normalization
        console.warn(
          "URL normalization failed, continuing with basic normalization",
          error
        );
      }

      // Remove any path, query parameters, or fragments that might remain
      normalizedDomain = normalizedDomain.split("/")[0];

      // Parse the domain with Public Suffix List
      const parsed = psl.parse(normalizedDomain);

      if (!parsed.domain) {
        return null; // Invalid domain according to PSL
      }

      // Check if the current subdomain is in the common subdomains list
      const subdomain = parsed.subdomain;
      if (subdomain) {
        const subdomainParts = subdomain.split(".");
        const firstSubdomain = subdomainParts[0];

        // If the first subdomain is common, strip it and return the domain
        if (COMMON_SUBDOMAINS.includes(firstSubdomain)) {
          // If there are more subdomain parts, keep them
          if (subdomainParts.length > 1) {
            const remainingSubdomains = subdomainParts.slice(1).join(".");
            return `${remainingSubdomains}.${parsed.domain}`;
          }
          return parsed.domain;
        }

        // Keep the subdomain if it's not common
        return normalizedDomain;
      }

      // Return the parsed domain if no subdomain
      return parsed.domain;
    } catch (error) {
      console.error("Domain sanitization error:", error);
      return null;
    }
  }

  /**
   * Validates a domain name
   *
   * @param domain The domain to validate
   * @returns True if the domain is valid, false otherwise
   */
  static validateDomain(domain: string): boolean {
    if (!domain || typeof domain !== "string") {
      return false;
    }

    const trimmedDomain = domain.trim();

    // Basic validation
    if (trimmedDomain === "" || trimmedDomain.includes(" ")) {
      return false;
    }

    // Reject email addresses
    if (trimmedDomain.includes("@")) {
      return false;
    }

    try {
      // Check if the domain has a valid TLD using PSL
      const parsed = psl.parse(trimmedDomain);
      if (!parsed.domain) {
        return false;
      }

      // Additional validation using URL constructor
      new URL(`http://${trimmedDomain}`);

      // Domain length validation (RFC 1035)
      if (trimmedDomain.length > 253) {
        return false;
      }

      // Domain label validation (RFC 1035)
      const labels = trimmedDomain.split(".");
      for (const label of labels) {
        if (label.length > 63) {
          return false;
        }

        // Check for valid characters in domain labels
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  /**
   * Processes a list of domains, validating and sanitizing them
   *
   * @param domains List of domains to process
   * @returns Object containing valid domains, invalid domains, and duplicates
   */
  static processDomainList(domains: string[]): {
    validDomains: string[];
    invalidDomains: string[];
    duplicates: string[];
  } {
    const result = {
      validDomains: [] as string[],
      invalidDomains: [] as string[],
      duplicates: [] as string[],
    };

    const uniqueDomains = new Set<string>();

    for (const domain of domains) {
      const sanitizedDomain = this.sanitizeDomain(domain);

      if (!sanitizedDomain) {
        result.invalidDomains.push(domain);
        continue;
      }

      if (uniqueDomains.has(sanitizedDomain)) {
        result.duplicates.push(domain);
        continue;
      }

      uniqueDomains.add(sanitizedDomain);
      result.validDomains.push(sanitizedDomain);
    }

    return result;
  }
}
