"use client";

import {
  useState,
  useMemo,
  ChangeEvent,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow, isValid } from "date-fns";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDomains, useRefreshDomain, domainKeys } from "@/hooks/use-domains";
import { DeleteDomainDialog } from "./delete-domain-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { createLogger } from "@/lib/logger";

// Create a logger instance for this component
const logger = createLogger("DomainList");

interface DomainListProps {
  refreshTrigger?: number;
}

interface Domain {
  id: string;
  name: string;
  domainExpiryDate: string | null;
  lastRefreshedAt?: string | null;
  domainCreatedDate?: string | null;
  domainUpdatedDate?: string | null;
  registrar?: string | null;
  emails?: string | null;
  nameServers?: string[] | null;
  status?: string | null;
  onCooldown?: boolean;
  cooldownEndsAt?: string | Date | null;
  response?: {
    error?: string;
    status?: boolean;
    message?: string;
    [key: string]: unknown;
  } | null; // Response data from WHOIS API
}
const DOMAINS_PER_PAGE = 10;

export function DomainList({ refreshTrigger = 0 }: DomainListProps) {
  const { data: session } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  // Track local refresh cooldowns
  const [localCooldowns, setLocalCooldowns] = useState<Record<string, number>>(
    {}
  );

  // Reference to store interval ID for cleaning up
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Using useToast for domain-related notifications, managed by our hooks now

  const {
    data: domainData,
    isLoading: loading,
    refetch: fetchDomains,
  } = useDomains(refreshTrigger, currentPage, DOMAINS_PER_PAGE, searchQuery);

  // Hook for refreshing domain information
  const {
    mutate: refreshDomainMutation,
    isPending: isRefreshing,
    variables: currentRefreshingId,
  } = useRefreshDomain();

  const domains = useMemo(
    () => domainData?.domains || [],
    [domainData?.domains]
  );
  const totalPages = domainData?.totalPages || 1;
  const totalDomains = domainData?.total || 0;

  const fuse = useMemo(() => {
    return new Fuse(domains, {
      keys: ["name"],
      threshold: 0.3,
      includeScore: true,
    });
  }, [domains]);

  useEffect(() => {
    setIsSearching(!!searchQuery.trim());
  }, [searchQuery]);

  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) return domains;
    const results = fuse.search(searchQuery);
    return results.map((result) => result.item);
  }, [domains, searchQuery, fuse]);

  const paginatedDomains = useMemo(() => {
    if (isSearching) {
      const startIndex = (currentPage - 1) * DOMAINS_PER_PAGE;
      const endIndex = startIndex + DOMAINS_PER_PAGE;
      return filteredDomains.slice(startIndex, endIndex);
    }
    return filteredDomains;
  }, [filteredDomains, currentPage, isSearching]);

  const sortedDomains = useMemo(() => {
    return [...paginatedDomains].sort((a, b) => {
      if (!a.domainExpiryDate && !b.domainExpiryDate) return 0;
      if (!a.domainExpiryDate) return 1;
      if (!b.domainExpiryDate) return -1;
      return (
        new Date(a.domainExpiryDate).getTime() -
        new Date(b.domainExpiryDate).getTime()
      );
    });
  }, [paginatedDomains]);

  const calculatedTotalPages = useMemo(() => {
    if (isSearching) {
      return Math.max(1, Math.ceil(filteredDomains.length / DOMAINS_PER_PAGE));
    }
    return totalPages;
  }, [isSearching, filteredDomains.length, totalPages]);

  const handleDomainDeleted = () => {
    const newTotalDomains = totalDomains - 1;
    const newTotalPages = Math.max(
      1,
      Math.ceil(newTotalDomains / DOMAINS_PER_PAGE)
    );

    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    } else {
      fetchDomains();
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Check if domain has a valid expiry date (but only if a lookup was attempted)
  const hasValidExpiryDate = (domain: Domain): boolean => {
    // If no refresh has been attempted yet, consider it valid (no error state)
    if (!domain.lastRefreshedAt) return true;

    if (!domain.domainExpiryDate) return false;

    try {
      const expiryDate = new Date(domain.domainExpiryDate);
      return isValid(expiryDate);
    } catch {
      return false;
    }
  };

  // Check if domain has WHOIS API errors (but only if a lookup was attempted)
  const hasWhoisApiError = (domain: Domain): boolean => {
    // If no refresh has been attempted yet, don't consider it an error
    if (!domain.lastRefreshedAt) return false;

    // Check if response contains error
    if (domain.response && typeof domain.response === "object") {
      if ("error" in domain.response) return true;

      // Check for API-specific error indicators
      if (domain.response.status === false) return true;
      if (
        domain.response.message &&
        typeof domain.response.message === "string" &&
        domain.response.message.toLowerCase().includes("error")
      )
        return true;
    }

    return false;
  };

  // Determine if a domain needs its first WHOIS lookup
  const needsFirstLookup = (domain: Domain): boolean => {
    return !domain.lastRefreshedAt;
  };

  // Setup an interval to check and clear cooldowns
  useEffect(() => {
    // Clean up any existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up an interval to check and clear cooldowns every second
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const updatedCooldowns = { ...localCooldowns };
      let hasChanges = false;

      // Check each cooldown and remove expired ones
      Object.keys(updatedCooldowns).forEach((domainId) => {
        if (updatedCooldowns[domainId] <= now) {
          delete updatedCooldowns[domainId];
          hasChanges = true;
        }
      });

      // Only update state if we removed any cooldowns
      if (hasChanges) {
        setLocalCooldowns(updatedCooldowns);
      }
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [localCooldowns]);

  const queryClient = useQueryClient();

  const refreshDomain = useCallback(
    (domain: Domain) => {
      // Apply a local cooldown of 1 minute to prevent spamming
      setLocalCooldowns((prev) => ({
        ...prev,
        [domain.id]: Date.now() + 60000, // 1 minute cooldown
      }));

      // Call the mutation function from our hook
      refreshDomainMutation(domain.id, {
        // On success, refetch the domains list to update UI
        onSuccess: () => {
          logger.info(`Domain refresh completed for ${domain.id}, refreshing UI`);
          // Force immediate refetch of the domains to update UI
          fetchDomains();
          
          // Invalidate any domain-specific data if it exists in cache
          // This ensures we get fresh data when viewing domain details
          if (queryClient) {
            queryClient.invalidateQueries({
              queryKey: domainKeys.lookupById(domain.id),
              refetchType: 'all',
            });
            
            // Invalidate all domain lists to ensure updated data is shown
            queryClient.invalidateQueries({
              queryKey: domainKeys.lists(),
              refetchType: 'all',
            });
          }
        },
      });
    },
    [refreshDomainMutation, fetchDomains, queryClient]
  );

  const isLocallyOnCooldown = (domainId: string): boolean => {
    return Boolean(
      localCooldowns[domainId] && localCooldowns[domainId] > Date.now()
    );
  };

  // Effect to automatically refresh domains that have never been looked up
  useEffect(() => {
    // Look for domains that need their first WHOIS lookup
    const domainsNeedingFirstLookup = domains.filter(needsFirstLookup);

    if (domainsNeedingFirstLookup.length > 0) {
      logger.info(
        `Found ${domainsNeedingFirstLookup.length} domains needing first lookup`
      );

      // Refresh each domain with a slight delay to avoid overwhelming the API
      domainsNeedingFirstLookup.forEach((domain, index) => {
        // Stagger requests to avoid rate limits
        setTimeout(() => {
          logger.info(`Auto-refreshing domain: ${domain.name}`);
          refreshDomain(domain);
        }, index * 2000); // 2 second delay between each request
      });
    }
  }, [domains, refreshDomain]); // Run this effect when the domains data changes

  const renderDomainItem = (domain: Domain) => {
    const invalidExpiry = !hasValidExpiryDate(domain);
    const hasApiError = hasWhoisApiError(domain);
    const needsRefresh = invalidExpiry || hasApiError;
    const isRefreshingThis = isRefreshing && currentRefreshingId === domain.id;

    // First check local cooldown (client-side), then check server-reported cooldown
    const onCooldown =
      isLocallyOnCooldown(domain.id) || (domain.onCooldown && !needsRefresh); // Override server cooldown if we need a refresh

    return (
      <div
        key={domain.id}
        className="border rounded-lg p-4 flex items-center justify-between transition-all duration-200 hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className="flex items-center space-x-4">
          <div
            className={`bg-gray-100 dark:bg-gray-800 p-4 rounded-lg ${
              needsRefresh ? "border-amber-500 border" : ""
            }`}
          >
            <div className="text-center">
              {hasValidExpiryDate(domain) ? (
                <>
                  <div className="text-sm">
                    {format(new Date(domain.domainExpiryDate!), "dd MMM")}
                  </div>
                  <div className="font-bold">
                    {format(new Date(domain.domainExpiryDate!), "yyyy")}
                  </div>
                </>
              ) : (
                <div
                  className="text-sm font-medium"
                  style={{
                    color: domain.lastRefreshedAt ? "#f59e0b" : "#6b7280",
                  }}
                >
                  {!domain.lastRefreshedAt
                    ? "Not checked"
                    : hasApiError
                    ? "API Error"
                    : "Unknown"}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold">{domain.name}</span>
            {domain.lastRefreshedAt && (
              <span className="text-xs text-muted-foreground">
                Last refreshed:{" "}
                {formatDistanceToNow(new Date(domain.lastRefreshedAt))} ago
              </span>
            )}
            {needsRefresh && domain.lastRefreshedAt && (
              <span className="text-xs text-amber-500 mt-1">
                {hasApiError
                  ? "WHOIS API error detected"
                  : "Expiry date missing or invalid"}
              </span>
            )}
            {!domain.lastRefreshedAt && (
              <span className="text-xs text-gray-500 mt-1">
                Click refresh to fetch domain information
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={
              needsRefresh ? "default" : onCooldown ? "secondary" : "outline"
            }
            size="icon"
            onClick={() => refreshDomain(domain)}
            disabled={isRefreshingThis || (onCooldown && !needsRefresh)}
            title={
              isRefreshingThis
                ? "Refreshing domain information..."
                : isLocallyOnCooldown(domain.id)
                ? `Refresh on cooldown for 1 minute`
                : domain.onCooldown && domain.cooldownEndsAt && !needsRefresh
                ? `Refresh on cooldown until ${new Date(
                    domain.cooldownEndsAt
                  ).toLocaleString()}`
                : needsRefresh
                ? "Refresh recommended due to error or missing data"
                : "Refresh domain information"
            }
            className={onCooldown && !needsRefresh ? "opacity-60" : ""}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                isRefreshingThis
                  ? "animate-spin"
                  : needsRefresh
                  ? "text-amber-500"
                  : onCooldown
                  ? "text-muted-foreground"
                  : ""
              }`}
            />
          </Button>
          <DeleteDomainDialog
            domainId={domain.id}
            domainName={domain.name}
            onDeleted={handleDomainDeleted}
          />
        </div>
      </div>
    );
  };

  const renderPagination = () => {
    const totalPagesToUse = isSearching ? calculatedTotalPages : totalPages;
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPagesToUse, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    const pageNumbers = Array.from(
      { length: endPage - startPage + 1 },
      (_, i) => startPage + i
    );

    return (
      <div className="flex items-center justify-center space-x-2 mt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {startPage > 1 && (
          <>
            <Button
              variant={currentPage === 1 ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(1)}
            >
              1
            </Button>
            {startPage > 2 && <span className="mx-1">...</span>}
          </>
        )}

        {pageNumbers.map((page) => (
          <Button
            key={page}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => handlePageChange(page)}
          >
            {page}
          </Button>
        ))}

        {endPage < totalPagesToUse && (
          <>
            {endPage < totalPagesToUse - 1 && <span className="mx-1">...</span>}
            <Button
              variant={currentPage === totalPagesToUse ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(totalPagesToUse)}
            >
              {totalPagesToUse}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handlePageChange(Math.min(totalPagesToUse, currentPage + 1))
          }
          disabled={currentPage === totalPagesToUse}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  if (!session?.user) {
    return null;
  }

  return (
    <Card className="mt-8 w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between">
          <CardTitle className="text-2xl font-bold">Your Domains</CardTitle>
          <div className="relative mt-2 md:mt-0 md:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              className="pl-8"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading domains...</p>
        ) : domains.length === 0 ? (
          <p>No domains added yet.</p>
        ) : filteredDomains.length === 0 ? (
          <p>No domains match your search.</p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              Showing {Math.min(DOMAINS_PER_PAGE, sortedDomains.length)} of{" "}
              {isSearching ? filteredDomains.length : totalDomains} domains
              {searchQuery && ` (filtered from ${domains.length} total)`}
            </div>

            <div className="space-y-4">
              {sortedDomains.map(renderDomainItem)}
            </div>

            {(isSearching ? filteredDomains.length : totalDomains) >
              DOMAINS_PER_PAGE && renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
