/**
 * Service for handling pending domains storage and retrieval
 */
export class PendingDomainsService {
  private static readonly STORAGE_KEY = 'pendingDomains';

  /**
   * Store a domain in the pending list
   */
  static storePendingDomain(domain: string): void {
    if (typeof window === 'undefined') return;
    
    const pendingDomains = this.getPendingDomains();
    if (!pendingDomains.includes(domain)) {
      pendingDomains.push(domain);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pendingDomains));
    }
  }

  /**
   * Get all pending domains
   */
  static getPendingDomains(): string[] {
    if (typeof window === 'undefined') return [];
    
    const storedDomains = localStorage.getItem(this.STORAGE_KEY);
    return storedDomains ? JSON.parse(storedDomains) : [];
  }

  /**
   * Clear all pending domains
   */
  static clearPendingDomains(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
