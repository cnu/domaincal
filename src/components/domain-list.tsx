"use client";

import { useState, useMemo, ChangeEvent, useEffect } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useDomains } from "@/hooks/use-domains";
import { DeleteDomainDialog } from "./delete-domain-dialog";

interface DomainListProps {
  refreshTrigger?: number;
}

const DOMAINS_PER_PAGE = 10;

export function DomainList({ refreshTrigger = 0 }: DomainListProps) {
  const { data: session } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Use TanStack Query to fetch domains
  const {
    data: domainData,
    isLoading: loading,
    refetch: fetchDomains,
  } = useDomains(refreshTrigger, currentPage, DOMAINS_PER_PAGE, searchQuery);

  // Domain deletion is now handled by the DeleteDomainDialog component

  // Extract domains and pagination data from the query result
  const domains = useMemo(
    () => domainData?.domains || [],
    [domainData?.domains]
  );
  const totalPages = domainData?.totalPages || 1;
  const totalDomains = domainData?.total || 0;

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(domains, {
      keys: ["name"],
      threshold: 0.3,
      includeScore: true,
    });
  }, [domains]);

  // Update isSearching state when searchQuery changes
  useEffect(() => {
    setIsSearching(!!searchQuery.trim());
  }, [searchQuery]);

  // Get filtered domains based on search query
  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) {
      // If not searching, just return the domains from the paginated API
      return domains;
    }

    const results = fuse.search(searchQuery);
    return results.map((result) => result.item);
  }, [domains, searchQuery, fuse]);

  // Get paginated domains
  const paginatedDomains = useMemo(() => {
    // If we're searching, we need to handle pagination client-side
    if (isSearching) {
      const startIndex = (currentPage - 1) * DOMAINS_PER_PAGE;
      const endIndex = startIndex + DOMAINS_PER_PAGE;
      return filteredDomains.slice(startIndex, endIndex);
    }

    // If not searching, the API already returned paginated results
    return filteredDomains;
  }, [filteredDomains, currentPage, isSearching]);

  // Sort domains by expiration date (closest expiry dates first)
  const sortedDomains = useMemo(() => {
    return [...paginatedDomains].sort((a, b) => {
      // Handle null expiry dates (put them at the end)
      if (!a.domainExpiryDate && !b.domainExpiryDate) return 0;
      if (!a.domainExpiryDate) return 1;
      if (!b.domainExpiryDate) return -1;

      // Sort by date (closest expiry dates first)
      return (
        new Date(a.domainExpiryDate).getTime() -
        new Date(b.domainExpiryDate).getTime()
      );
    });
  }, [paginatedDomains]);

  // Recalculate total pages when searching client-side
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

    // If we deleted the last item on the last page, go to previous page
    if (currentPage > newTotalPages) {
      setCurrentPage(newTotalPages);
    } else {
      // Otherwise just refresh the current page
      fetchDomains();
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const renderPagination = () => {
    const totalPagesToUse = isSearching ? calculatedTotalPages : totalPages;
    const pageNumbers = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPagesToUse, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

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
              {sortedDomains.map((domain) => (
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
                              {format(
                                new Date(domain.domainExpiryDate),
                                "dd MMM"
                              )}
                            </div>
                            <div className="font-bold">
                              {format(
                                new Date(domain.domainExpiryDate),
                                "yyyy"
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-2xl font-bold">...</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="font-bold">{domain.name}</span>
                    </div>
                  </div>
                  <DeleteDomainDialog
                    domainId={domain.id}
                    domainName={domain.name}
                    onDeleted={handleDomainDeleted}
                  />
                </div>
              ))}
            </div>

            {/* Debug pagination info */}
            <div className="text-xs text-muted-foreground mt-4">
              Debug: {isSearching ? filteredDomains.length : totalDomains} total
              domains,
              {isSearching ? calculatedTotalPages : totalPages} pages, currently
              on page {currentPage}
            </div>

            {/* Render pagination if needed */}
            {(isSearching ? filteredDomains.length : totalDomains) >
              DOMAINS_PER_PAGE && renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
