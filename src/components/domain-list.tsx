"use client";

import { useState, useEffect, useMemo, ChangeEvent, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "./ui/use-toast";
import { format } from "date-fns";
import { Trash2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Fuse from "fuse.js";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Domain {
  id: string;
  name: string;
  domainExpiryDate: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface DomainListProps {
  refreshTrigger?: number;
}

const DOMAINS_PER_PAGE = 10;

export function DomainList({ refreshTrigger = 0 }: DomainListProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDomains, setTotalDomains] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(domains, {
      keys: ["name"],
      threshold: 0.3,
      includeScore: true,
    });
  }, [domains]);

  // Get filtered domains based on search query
  const filteredDomains = useMemo(() => {
    if (!searchQuery.trim()) {
      setIsSearching(false);
      // If not searching, just return the domains from the paginated API
      return domains;
    }

    setIsSearching(true);
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

  // Update total pages when filtered domains change
  useEffect(() => {
    // Only update these values when searching, otherwise they come from the API
    if (isSearching) {
      setTotalDomains(filteredDomains.length);
      setTotalPages(
        Math.max(1, Math.ceil(filteredDomains.length / DOMAINS_PER_PAGE))
      );

      // Reset to page 1 if current page is now invalid
      if (currentPage > Math.ceil(filteredDomains.length / DOMAINS_PER_PAGE)) {
        setCurrentPage(1);
      }
    }
  }, [filteredDomains, currentPage, isSearching]);

  // Function to fetch domains
  const fetchDomains = useCallback(async () => {
    if (!session?.user) {
      setDomains([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // If we're searching, fetch all domains for client-side search
      // Otherwise, use the paginated API
      const url = searchQuery.trim()
        ? `/api/domains?limit=1000` // Get all domains for client-side search
        : `/api/domains?page=${currentPage}&limit=${DOMAINS_PER_PAGE}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch domains");
      }

      const data: {
        domains: Domain[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      } = await response.json();
      console.log("API response:", data);
      setDomains(data.domains || []);

      // Calculate total pages based on total domains
      const calculatedTotalPages = Math.ceil(
        (data.total || 0) / DOMAINS_PER_PAGE
      );
      console.log("Calculated total pages:", calculatedTotalPages);

      // Only update pagination if we're not searching
      if (!searchQuery.trim()) {
        // Use the calculated total pages if available, otherwise use the server-provided value
        // Ensure we always have at least 1 page even if there are no domains
        const finalTotalPages = Math.max(
          calculatedTotalPages || data.totalPages || 1,
          1
        );
        setTotalPages(finalTotalPages);
        setTotalDomains(data.total || 0);

        // Ensure current page is valid
        if (currentPage > finalTotalPages) {
          setCurrentPage(finalTotalPages);
        }

        console.log("Pagination data:", {
          serverTotalPages: data.totalPages,
          calculatedTotalPages,
          finalTotalPages,
          totalDomains: data.total,
          currentPage,
        });
      }
    } catch (error) {
      console.error("Error fetching domains:", error);
      toast({
        title: "Error",
        description: "Failed to load domains",
        variant: "destructive",
        id: "domains-error",
      });
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, session?.user, toast]);

  // Fetch domains with pagination and search
  useEffect(() => {
    fetchDomains();
  }, [session, refreshTrigger, toast, currentPage, searchQuery, fetchDomains]);

  // Sort domains by expiration date (latest first)
  const sortedDomains = useMemo(() => {
    return [...paginatedDomains].sort((a, b) => {
      // Handle null expiry dates (put them at the end)
      if (!a.domainExpiryDate && !b.domainExpiryDate) return 0;
      if (!a.domainExpiryDate) return 1;
      if (!b.domainExpiryDate) return -1;

      // Sort by date (latest first)
      return (
        new Date(b.domainExpiryDate).getTime() -
        new Date(a.domainExpiryDate).getTime()
      );
    });
  }, [paginatedDomains]);

  const handleDeleteDomain = async (domainId: string) => {
    if (window.confirm("Are you sure you want to delete this domain?")) {
      setDeletingDomainId(domainId);
      try {
        const response = await fetch(`/api/domains/${domainId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete domain");
        }

        if (isSearching) {
          // If we're searching, just remove the domain from the local state
          setDomains((prevDomains) =>
            prevDomains.filter((domain) => domain.id !== domainId)
          );
        } else {
          // If we're not searching, refetch the current page to get updated data
          // This ensures pagination remains accurate
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
        }

        toast({
          title: "Success",
          description: "Domain deleted successfully",
          id: "domains-deleted",
        });
      } catch (error) {
        console.error("Error deleting domain:", error);
        toast({
          title: "Error",
          description: "Failed to delete domain",
          variant: "destructive",
          id: "domains-delete-error",
        });
      } finally {
        setDeletingDomainId(null);
      }
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
    console.log("Rendering pagination with totalPages:", totalPages);

    // For debugging, always show pagination even if there's only 1 page
    // We'll remove this condition later once we confirm pagination is working
    // if (totalPages <= 1) {
    //   console.log("Not showing pagination because totalPages <= 1");
    //   return null;
    // }

    const pageNumbers = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

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

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="mx-1">...</span>}
            <Button
              variant={currentPage === totalPages ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handlePageChange(Math.min(totalPages, currentPage + 1))
          }
          disabled={currentPage === totalPages}
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
              {totalDomains} domains
              {searchQuery && ` (filtered from ${domains.length} total)`}
            </div>

            <div className="space-y-4">
              {sortedDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="border rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                      <div className="text-center">
                        {domain.domainExpiryDate ? (
                          <>
                            <div className="text-sm">
                              {format(
                                new Date(domain.domainExpiryDate),
                                "dd MMMM"
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
                  <button
                    onClick={() => handleDeleteDomain(domain.id)}
                    disabled={deletingDomainId === domain.id}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                    aria-label={`Delete ${domain.name}`}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>

            {/* Debug pagination info */}
            <div className="text-xs text-muted-foreground mt-4">
              Debug: {totalDomains} total domains, {totalPages} pages, currently
              on page {currentPage}
            </div>

            {/* Always render pagination */}
            {totalDomains > 10 && renderPagination()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
