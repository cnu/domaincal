import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import React from "react";
import { apiClient } from "@/lib/api-client";

interface Domain {
  id: string;
  name: string;
  domainExpiryDate: string | null;
  domainCreatedDate?: string | null;
  domainUpdatedDate?: string | null;
  lastRefreshedAt?: string | null;
  registrar?: string | null;
  emails?: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface DomainResponse {
  domains: Domain[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DomainSubmitResponse {
  error?: string;
  message?: string;
  domains: Domain[];
  added?: number;
  skipped?: number;
  failed?: number;
  failedDomains?: string[];
  duplicateDomains?: string[];
  totalRequested?: number;
  uniqueRequested?: number;
}

// Query key factory for domains
export const domainKeys = {
  all: ["domains"] as const,
  lists: () => [...domainKeys.all, "list"] as const,
  list: (filters: {
    refreshTrigger?: number;
    page?: number;
    limit?: number;
    search?: string;
  }) => [...domainKeys.lists(), filters] as const,
  details: () => [...domainKeys.all, "detail"] as const,
  detail: (id: string) => [...domainKeys.details(), id] as const,
  lookup: () => [...domainKeys.all, "lookup"] as const,
  lookupById: (id: string) => [...domainKeys.lookup(), id] as const,
};

/**
 * Hook for fetching domains with pagination and search
 * Includes automatic refetching on window focus and query invalidation
 */
export const useDomains = (
  refreshTrigger = 0,
  page = 1,
  limit = 10,
  search = ""
) => {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Track when the window/tab regains focus to refresh data
  React.useEffect(() => {
    // Function to refresh domains when the window regains focus
    const handleFocus = () => {
      queryClient.invalidateQueries({ queryKey: domainKeys.lists() });
    };

    // Add event listeners for visibility change and focus
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    });
    window.addEventListener("focus", handleFocus);

    // Clean up event listeners
    return () => {
      window.removeEventListener("visibilitychange", handleFocus);
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient]);

  const result = useQuery({
    queryKey: domainKeys.list({ refreshTrigger, page, limit, search }),
    queryFn: async () => {
      if (!session?.user) {
        return {
          domains: [],
          total: 0,
          page: 1,
          limit,
          totalPages: 1,
        } as DomainResponse;
      }

      // If we're searching, fetch all domains for client-side search
      // Otherwise, use the paginated API
      const url = search.trim()
        ? `/api/domains?limit=1000` // Get all domains for client-side search
        : `/api/domains?page=${page}&limit=${limit}`;

      const response = await fetch(url);

      if (!response.ok) {
        toast({
          id: "domains-error",
          title: "Error",
          description: "Failed to fetch domains",
          variant: "destructive",
        });
      }

      return (await response.json()) as DomainResponse;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!session?.user,
  });

  // Handle errors outside the query options
  React.useEffect(() => {
    if (result.error) {
      toast({
        title: "Error",
        description:
          result.error instanceof Error
            ? result.error.message
            : "Failed to load domains",
        variant: "destructive",
        id: "domains-error",
      });
    }
  }, [result.error, toast]);

  return result;
};

/**
 * Hook for adding domains to track
 * Uses optimistic updates and proper query invalidation
 */
export function useAddDomains() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<DomainSubmitResponse, Error, string[]>({
    mutationFn: async (domains: string[]) => {
      // Validate input before sending to API
      if (!domains.length) {
        throw new Error("No domains provided");
      }

      if (domains.length > 20) {
        throw new Error(
          `Too many domains: ${domains.length}. Maximum allowed is 20.`
        );
      }

      // Use the API client for consistent error handling
      const response = await apiClient.post<DomainSubmitResponse>(
        "/api/domains",
        { domains }
      );
      return response;
    },
    onMutate: async (domains) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: domainKeys.lists() });

      // Return context with the domains being added for potential rollback
      return { domains };
    },
    onSuccess: (data) => {
      // Create a detailed success message
      let successMessage = "";
      if (data.added && data.added > 0) {
        successMessage =
          data.added === 1
            ? "1 domain added successfully"
            : `${data.added} domains added successfully`;
      }

      // Add information about skipped/duplicate domains if any
      if (data.skipped && data.skipped > 0) {
        successMessage +=
          data.skipped === 1
            ? ", 1 domain already tracked"
            : `, ${data.skipped} domains already tracked`;
      }

      // Add information about failed domains if any
      if (data.failed && data.failed > 0) {
        successMessage +=
          data.failed === 1
            ? ", 1 domain failed"
            : `, ${data.failed} domains failed`;
      }

      toast({
        id: uuidv4(),
        title: "Domain Tracking Update",
        description: successMessage || "Domain processing completed",
        variant: "default",
      });

      // If there were specific failures, show them in a separate toast
      if (data.failedDomains && data.failedDomains.length > 0) {
        toast({
          id: uuidv4(),
          title: "Failed Domains",
          description: `Failed to process: ${data.failedDomains.join(", ")}`,
          variant: "destructive",
        });
      }

      // Invalidate domains query to refresh the list
      queryClient.invalidateQueries({ queryKey: domainKeys.lists() });
    },
    onError: (error: Error) => {
      toast({
        id: uuidv4(),
        title: "Error Adding Domains",
        description: error.message || "Failed to track domains",
        variant: "destructive",
      });
    },
  });
}

// Delete domain mutation
export function useDeleteDomain() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (domainId: string) => {
      const response = await fetch(`/api/domains/${domainId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          id: "failed-deleting-domains",
          title: "Error",
          description: data.error || "Failed to delete domain",
          variant: "destructive",
        });
      }

      return domainId;
    },
    onSuccess: (domainId) => {
      // Show success toast
      const id = uuidv4();
      toast({
        id,
        title: "Success",
        description: `Domain deleted successfully (ID: ${domainId})`,
      });

      // Invalidate domains query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error: Error) => {
      const id = uuidv4();
      toast({
        id,
        title: "Error",
        description: error.message || "Failed to delete domain",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for refreshing domain WHOIS information
 * Includes optimistic UI updates and proper query invalidation
 */
export function useRefreshDomainWhois() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  interface DomainLookupResponse {
    domain?: {
      name: string;
      domainExpiryDate?: string | null;
    };
    message?: string;
  }

  return useMutation<DomainLookupResponse, Error, string>({
    mutationFn: async (domainId: string) => {
      // Use the API client for consistent error handling
      return await apiClient.post<DomainLookupResponse>(
        `/api/domains/${domainId}/lookup`
      );
    },
    onMutate: async (domainId) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: domainKeys.detail(domainId),
      });
      await queryClient.cancelQueries({ queryKey: domainKeys.lists() });

      // Get the current domain data for potential rollback
      const previousDomains = queryClient.getQueryData(domainKeys.lists());

      // Return context with the previous data
      return { previousDomains, domainId } as {
        previousDomains: unknown;
        domainId: string;
      };
    },
    onSuccess: (data, domainId) => {
      // Show success toast
      toast({
        id: uuidv4(),
        title: "WHOIS Updated",
        description: `Domain information for ${
          data.domain?.name || "domain"
        } refreshed successfully`,
      });

      // Invalidate specific queries to refresh the data
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
      queryClient.invalidateQueries({ queryKey: domainKeys.lists() });
    },
    onError: (error: Error, domainId: string, context: unknown) => {
      // Cast the context to the expected type
      const typedContext = context as
        | { previousDomains?: unknown; domainId?: string }
        | undefined;

      // If we have previous domain data, restore it on error
      if (typedContext && typedContext.previousDomains) {
        queryClient.setQueryData(
          domainKeys.lists(),
          typedContext.previousDomains
        );
      }

      // Check if this is a timeout error
      const isTimeoutError = 
        error.message?.includes('timeout') || 
        error.message?.includes('504') || 
        error.message?.includes('Gateway Timeout');

      toast({
        id: uuidv4(),
        title: isTimeoutError ? "Lookup Timeout" : "Refresh Failed",
        description: isTimeoutError 
          ? "The domain lookup is taking too long. This can happen with some domain registrars. Please try again later."
          : error.message || "Failed to refresh domain information",
        variant: "destructive",
      });
    },
    onSettled: (data, error, domainId) => {
      // Always invalidate queries after settled (success or error)
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
    },
  });
}
