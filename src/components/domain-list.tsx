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

// Constants
const DOMAINS_PER_PAGE = 10;
const MAX_RETRIES = 3; // Maximum number of retry attempts
const MAX_AUTO_REFRESH_ATTEMPTS = 3; // Maximum auto-refresh attempts
const COOLDOWN_DURATION = 60000; // 1 minute cooldown

// Create a logger instance for this component
const logger = createLogger("DomainList");

type WhoisResponse = {
  error?: string;
  status?: boolean;
  message?: string;
  domain_registered?: string;
  [key: string]: unknown;
};

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
  response?: WhoisResponse | null;
}

interface DomainListProps {
  refreshTrigger?: number;
}

export function DomainList({
  refreshTrigger = 0,
}: DomainListProps): React.ReactElement {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // State hooks
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [localCooldowns, setLocalCooldowns] = useState<Record<string, number>>(
    {}
  );

  // Ref hooks
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingWhoisRef = useRef<boolean>(false);
  const domainRetryCountsRef = useRef<Record<string, number>>({});
  const autoRefreshAttemptsRef = useRef<number>(0);
  const lastRefreshRef = useRef(Date.now());

  // Polling intervals (5s, 15s, 25s)
  const POLLING_INTERVALS = useMemo(() => [5000, 15000, 25000], []);

  // Data fetching hooks
  const {
    data: domainData,
    isLoading: loading,
    refetch: fetchDomains,
  } = useDomains(refreshTrigger, currentPage, DOMAINS_PER_PAGE, searchQuery);

  const {
    mutate: refreshDomainMutation,
    isPending: isRefreshing,
    variables: currentRefreshingId,
  } = useRefreshDomain();

  // Derived data
  const domains = useMemo(
    () => domainData?.domains || [],
    [domainData?.domains]
  );
  const totalPages = domainData?.totalPages || 1;
  const totalDomains = domainData?.total || 0;

  // Search utility
  const fuse = useMemo(
    () =>
      new Fuse(domains, {
        keys: ["name"],
        threshold: 0.3,
        includeScore: true,
      }),
    [domains]
  );

  // Check if any domains are waiting for WHOIS data
  const hasPendingWhoisLookups = useMemo(() => {
    return domains.some((domain) => {
      // If domain has an error, check if we've exceeded retry count
      if (
        "response" in domain &&
        domain.response !== null &&
        typeof domain.response === "object" &&
        "error" in domain.response
      ) {
        // Get current retry count or initialize to 0
        const retryCount = domainRetryCountsRef.current[domain.id] || 0;

        // If we've already tried MAX_RETRIES times, don't retry again
        if (retryCount >= MAX_RETRIES) {
          logger.info(
            `Skipping further refresh attempts for domain ${domain.name} after ${MAX_RETRIES} retries`
          );
          return false;
        }

        // Otherwise increment the retry count
        domainRetryCountsRef.current[domain.id] = retryCount + 1;
        logger.info(
          `Domain ${domain.name} has error, retry attempt ${
            retryCount + 1
          }/${MAX_RETRIES}`
        );
        return true;
      }

      // If no expiry date, consider it pending
      return !domain.domainExpiryDate;
    });
  }, [domains]);

  // This variable is now defined at the top of the component

  // Set up auto-refresh for domains with progressive polling intervals
  useEffect(() => {
    // Update the ref so we can check it in other effects
    pendingWhoisRef.current = hasPendingWhoisLookups;

    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If we have pending lookups and haven't exceeded max attempts, schedule a poll
    if (
      hasPendingWhoisLookups &&
      autoRefreshAttemptsRef.current < MAX_AUTO_REFRESH_ATTEMPTS
    ) {
      // Calculate which poll interval to use based on current attempt number
      const currentAttempt = autoRefreshAttemptsRef.current;
      const waitTime = POLLING_INTERVALS[currentAttempt];

      logger.info(
        `Scheduling poll for domains with pending WHOIS data (attempt ${currentAttempt + 1}/${MAX_AUTO_REFRESH_ATTEMPTS}, waiting ${waitTime / 1000}s)`
      );

      // Schedule the next poll after the appropriate wait time
      intervalRef.current = setTimeout(() => {
        // Only proceed if we haven't exceeded max attempts
        if (autoRefreshAttemptsRef.current < MAX_AUTO_REFRESH_ATTEMPTS) {
          logger.info(
            `Polling domains for WHOIS updates (attempt ${currentAttempt + 1}/${MAX_AUTO_REFRESH_ATTEMPTS})`
          );

          // Increment attempt counter for next time
          autoRefreshAttemptsRef.current++;

          // Fetch the domains
          fetchDomains();

          // Record the refresh time
          lastRefreshRef.current = Date.now();
        }
      }, waitTime);
    } else if (hasPendingWhoisLookups) {
      // If we have pending lookups but reached max attempts, log it
      logger.info(
        `Maximum auto-refresh attempts (${MAX_AUTO_REFRESH_ATTEMPTS}) reached. Stopping auto-refresh.`
      );
    }

    // Cleanup on unmount or re-run
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasPendingWhoisLookups, fetchDomains, POLLING_INTERVALS]);

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

  // Memoize the domain deletion handler to avoid recreation on each render
  const handleDomainDeleted = useCallback(() => {
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
  }, [totalDomains, currentPage, fetchDomains]);

  // Memoize the page change handler
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Domain status checking utility functions
  const domainUtils = useMemo(
    () => ({
      // Check if domain has a valid expiry date
      hasValidExpiryDate: (domain: Domain): boolean => {
        // If no refresh attempted yet, consider it valid (no error state)
        if (!domain.lastRefreshedAt) return true;
        if (!domain.domainExpiryDate) return false;

        try {
          return isValid(new Date(domain.domainExpiryDate));
        } catch {
          return false;
        }
      },

      // Check if domain has WHOIS API errors
      hasWhoisApiError: (domain: Domain): boolean => {
        // If no refresh attempted yet, don't consider it an error
        if (!domain.lastRefreshedAt) return false;

        // Check if response contains error
        if (domain.response && typeof domain.response === "object") {
          if ("error" in domain.response) return true;
          if (domain.response.status === false) return true;
          if (
            domain.response.message &&
            typeof domain.response.message === "string" &&
            domain.response.message.toLowerCase().includes("error")
          )
            return true;
        }

        return false;
      },

      // Determine if domain needs first WHOIS lookup
      needsFirstLookup: (domain: Domain): boolean => !domain.lastRefreshedAt,

      // Check if domain is on local cooldown
      isLocallyOnCooldown: (domainId: string): boolean =>
        Boolean(
          localCooldowns[domainId] && localCooldowns[domainId] > Date.now()
        ),
    }),
    [localCooldowns]
  );

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

  const refreshDomain = useCallback(
    (domain: Domain) => {
      // Apply a local cooldown to prevent spamming
      setLocalCooldowns((prev) => ({
        ...prev,
        [domain.id]: Date.now() + COOLDOWN_DURATION,
      }));

      // Call the mutation function from our hook
      refreshDomainMutation(domain.id, {
        // On success, refetch the domains list to update UI
        onSuccess: () => {
          logger.info(
            `Domain refresh completed for ${domain.id}, refreshing UI`
          );
          // Reset retry counter for this domain on successful refresh
          if (domainRetryCountsRef.current[domain.id]) {
            logger.info(
              `Resetting retry counter for domain ${domain.name} after successful refresh`
            );
            delete domainRetryCountsRef.current[domain.id];
          }

          // Force immediate refetch of the domains to update UI
          fetchDomains();

          // Invalidate any domain-specific data if it exists in cache
          // This ensures we get fresh data when viewing domain details
          if (queryClient) {
            queryClient.invalidateQueries({
              queryKey: domainKeys.lookupById(domain.id),
              refetchType: "all",
            });

            // Invalidate all domain lists to ensure updated data is shown
            queryClient.invalidateQueries({
              queryKey: domainKeys.lists(),
              refetchType: "all",
            });
          }
        },
      });
    },
    [refreshDomainMutation, fetchDomains, queryClient]
  );

  // Now defined in domainUtils

  // Effect to automatically refresh domains that have never been looked up
  useEffect(() => {
    // Look for domains that need their first WHOIS lookup
    const domainsNeedingFirstLookup = domains.filter(
      domainUtils.needsFirstLookup
    );

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
  }, [domains, refreshDomain, domainUtils]); // Run this effect when the domains data changes

  // Optimized renderDomainItem with clearer code organization
  // Render a single domain item - memoized to prevent unnecessary re-renders
  const renderDomainItem = useCallback(
    (domain: Domain) => {
      // Status checks
      const invalidExpiry = !domainUtils.hasValidExpiryDate(domain);
      const hasApiError = domainUtils.hasWhoisApiError(domain);
      const needsRefresh = invalidExpiry || hasApiError;
      const isRefreshingThis =
        isRefreshing && currentRefreshingId === domain.id;

      // Cooldown logic - override server cooldown if refresh is needed
      const onCooldown =
        domainUtils.isLocallyOnCooldown(domain.id) ||
        (domain.onCooldown && !needsRefresh);

      // Button status and tooltip text
      // We still check if domain is not registered for box styling, but not for button
      // Use outline variant consistently for all scenarios
      const buttonVariant = "outline";
      const buttonDisabled = isRefreshingThis || (onCooldown && !needsRefresh);
      const buttonTooltip = isRefreshingThis
        ? "Refreshing domain information..."
        : domainUtils.isLocallyOnCooldown(domain.id)
          ? `Refresh on cooldown for ${Math.ceil(COOLDOWN_DURATION / 1000)} seconds`
          : domain.onCooldown && domain.cooldownEndsAt && !needsRefresh
            ? `Refresh on cooldown until ${new Date(domain.cooldownEndsAt).toLocaleString()}`
            : needsRefresh
              ? "Refresh recommended due to error or missing data"
              : "Refresh domain information";

      // Icon styling - keeping animation but removing colors
      const iconClassName = `h-4 w-4 ${
        isRefreshingThis
          ? "animate-spin"
          : onCooldown
            ? "text-muted-foreground"
            : ""
      }`;

      return (
        <div
          key={domain.id}
          className="border rounded-lg p-4 flex items-center justify-between transition-all duration-200 hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <div className="flex items-center space-x-4">
            <div
              className={`bg-gray-100 dark:bg-gray-800 p-4 rounded-lg min-w-[100px] min-h-[80px] flex items-center justify-center ${
                needsRefresh ? "border-amber-500 border" : ""
              } ${domain.response && typeof domain.response === "object" && (domain.response as WhoisResponse).domain_registered === "no" ? "border-green-500 border" : ""}`}
            >
              <div
                className="text-center w-full"
                style={{
                  width: "80px",
                  height: "60px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {domainUtils.hasValidExpiryDate(domain) ? (
                  <>
                    <div className="text-sm">
                      {format(new Date(domain.domainExpiryDate!), "dd MMM")}
                    </div>
                    <div className="font-bold">
                      {format(new Date(domain.domainExpiryDate!), "yyyy")}
                    </div>
                  </>
                ) : (
                  domain.response &&
                  typeof domain.response === "object" &&
                  (domain.response as WhoisResponse).domain_registered === "no" ? (
                    // Green dot for unregistered domains
                    <div className="flex items-center justify-center h-full">
                      <div 
                        className="rounded-full bg-green-500" 
                        style={{ width: '24px', height: '24px' }}
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        className="text-sm"
                        style={{
                          color: domain.lastRefreshedAt ? "#f59e0b" : "#6b7280",
                        }}
                      >
                        Status
                      </div>
                      <div
                        className="font-bold"
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
                    </>
                  )
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
                <span
                  className={`text-xs mt-1 ${domain.response && typeof domain.response === "object" && (domain.response as WhoisResponse).domain_registered === "no" ? "text-green-500" : "text-amber-500"}`}
                >
                  {hasApiError
                    ? "WHOIS API error detected"
                    : domain.response &&
                        typeof domain.response === "object" &&
                        (domain.response as WhoisResponse).domain_registered ===
                          "no"
                      ? "Domain is not registered"
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
              variant={buttonVariant}
              size="icon"
              onClick={() => refreshDomain(domain)}
              disabled={buttonDisabled}
              title={buttonTooltip}
              className={`${onCooldown && !needsRefresh ? "opacity-60" : ""}`}
            >
              <RefreshCw className={iconClassName} />
            </Button>
            <DeleteDomainDialog
              domainId={domain.id}
              domainName={domain.name}
              onDeleted={handleDomainDeleted}
            />
          </div>
        </div>
      );
    },
    [
      domainUtils,
      isRefreshing,
      currentRefreshingId,
      refreshDomain,
      handleDomainDeleted,
    ]
  );

  const renderPagination = useCallback(() => {
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
  }, [
    currentPage,
    isSearching,
    calculatedTotalPages,
    totalPages,
    handlePageChange,
  ]);

  // Final render with null check for session
  if (!session?.user) {
    // Return empty fragment instead of null to satisfy React.ReactElement type
    return <></>;
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
