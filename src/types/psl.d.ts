declare module 'psl' {
  interface ParsedDomain {
    tld: string | null;
    sld?: string | null;
    domain: string | null;
    subdomain: string | null;
    listed: boolean;
  }

  /**
   * Parse a domain using the Public Suffix List
   */
  export function parse(domain: string): ParsedDomain;

  /**
   * Check if a domain is valid according to the Public Suffix List
   */
  export function isValid(domain: string): boolean;

  /**
   * Get the public suffix of a domain
   */
  export function get(domain: string): string | null;

  export default {
    parse,
    isValid,
    get
  };
}
