"use client";

import { useState, useMemo, ChangeEvent, useEffect } from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDomains, useRefreshDomain } from "@/hooks/use-domains";
import { DeleteDomainDialog } from "./delete-domain-dialog";

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
}
const DOMAINS_PER_PAGE = 10;

export function DomainList({ refreshTrigger = 0 }: DomainListProps) {
  const { data: session } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
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

  const refreshDomain = (domain: Domain) => {
    // Call the mutation function from our hook
    refreshDomainMutation(domain.id, {
      // On success, refetch the domains list to update UI
      onSuccess: () => {
        fetchDomains();
      },
    });
  };

  const renderDomainItem = (domain: Domain) => (
    <div
      key={domain.id}
      className="border rounded-lg p-4 flex items-center justify-between transition-all duration-200 hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/50"
    >
      <div className="flex items-center space-x-4">
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-center">
            {domain.domainExpiryDate ? (
              <>
                <div className="text-sm">
                  {format(new Date(domain.domainExpiryDate), "dd MMM")}
                </div>
                <div className="font-bold">
                  {format(new Date(domain.domainExpiryDate), "yyyy")}
                </div>
              </>
            ) : (
              <div className="text-2xl font-bold">...</div>
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
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant={domain.onCooldown ? "secondary" : "outline"}
          size="icon"
          onClick={() => refreshDomain(domain)}
          disabled={
            (isRefreshing && currentRefreshingId === domain.id) ||
            domain.onCooldown
          }
          title={
            domain.onCooldown && domain.cooldownEndsAt
              ? `Refresh on cooldown until ${new Date(
                  domain.cooldownEndsAt
                ).toLocaleString()}`
              : "Refresh domain information"
          }
          className={domain.onCooldown ? "opacity-60" : ""}
        >
          <RefreshCw
            className={`h-4 w-4 ${
              isRefreshing && currentRefreshingId === domain.id
                ? "animate-spin"
                : domain.onCooldown
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

            <div className="text-xs text-muted-foreground mt-4">
              Debug: {isSearching ? filteredDomains.length : totalDomains} total
              domains,
              {isSearching ? calculatedTotalPages : totalPages} pages, currently
              on page {currentPage}
            </div>

            {(isSearching ? filteredDomains.length : totalDomains) >
              DOMAINS_PER_PAGE && renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
