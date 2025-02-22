const PENDING_DOMAINS_KEY = 'pendingDomains'

export const getPendingDomains = (): string[] => {
  if (typeof window === 'undefined') return []
  
  const stored = localStorage.getItem(PENDING_DOMAINS_KEY)
  return stored ? JSON.parse(stored) : []
}

export const addPendingDomain = (domain: string): void => {
  if (typeof window === 'undefined') return
  
  const domains = getPendingDomains()
  if (!domains.includes(domain)) {
    domains.push(domain)
    localStorage.setItem(PENDING_DOMAINS_KEY, JSON.stringify(domains))
  }
}

export const clearPendingDomains = (): void => {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(PENDING_DOMAINS_KEY)
}
