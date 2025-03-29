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

      try {
        // Determine the API endpoint based on whether we're searching or not
        const endpoint = search.trim()
          ? "/api/domains" // Get all domains for client-side search
          : "/api/domains";

        // Use pagination parameters if not searching
        const params: Record<string, string> = {};
        if (!search.trim()) {
          params.page = page.toString();
          params.limit = limit.toString();
        }

        // Make the API call through our standard client - handle new API response format
        const response = await apiClient.get<{
          success: boolean;
          data: DomainResponse;
        }>(endpoint, { params });

        // The API now returns data wrapped in a response object with { success, data }
        // We need to extract the data property which contains our DomainResponse
        return response.data;
      } catch (error) {
        console.error("Error fetching domains:", error);
        toast({
          id: "domains-error",
          title: "Error",
          description: "Failed to fetch domains",
          variant: "destructive",
        });
        throw error;
      }
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
/**
 * Hook for refreshing domain information
 * Uses React Query's useMutation for handling the refresh operation
 */
export function useRefreshDomain() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  interface DomainRefreshResponse {
    success: boolean;
    domain?: Domain;
    message?: string;
  }

  // API wrapper response format
  interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
  }

  return useMutation<DomainRefreshResponse, Error, string>({
    mutationFn: async (domainId: string) => {
      // Validate input
      if (!domainId) {
        throw new Error("No domain ID provided");
      }
      // Call the controller via API endpoint - handle the wrapped response format
      const apiResponse = await apiClient.post<
        ApiResponse<DomainRefreshResponse>
      >(`/api/domains/${domainId}/lookup`, { forceRefresh: true });

      // Return the data from the response
      return apiResponse.data;
    },
    onSuccess: (data, domainId) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({
        queryKey: domainKeys.lookupById(domainId),
      });
      queryClient.invalidateQueries({ queryKey: domainKeys.lists() });

      // Show success toast
      toast({
        title: "WHOIS Updated",
        description: `Domain information refreshed successfully`,
        id: uuidv4(),
      });
    },
    onError: (error) => {
      // Handle specific error types
      let errorMessage = "Failed to refresh domain information";
      let variant: "default" | "destructive" = "destructive";

      if (error.message.includes("cooldown")) {
        errorMessage = error.message;
        variant = "default"; // Use default variant for cooldown (not a critical error)
      } else {
        errorMessage = error.message || "Failed to refresh domain information";
      }

      toast({
        title: error.message.includes("cooldown")
          ? "Refresh Cooldown"
          : "Error",
        description: errorMessage,
        variant,
        id: uuidv4(),
      });
    },
  });
}

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

/**
 * Hook for deleting a domain
 * Uses proper query invalidation and consistent error handling
 */
export function useDeleteDomain() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (domainId: string) => {
      try {
        // Use the API client for consistent error handling
        const result = await apiClient.delete<{
          success: boolean;
          message: string;
        }>(`/api/domains/${domainId}`);
        return { domainId, ...result };
      } catch (error: unknown) {
        // Extract error message from the response if available
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === "object" &&
              error !== null &&
              "response" in error &&
              error.response
            ? (error.response as { data?: { error?: string } })?.data?.error
            : "Failed to delete domain";
        throw new Error(errorMessage);
      }
    },
    onSuccess: () => {
      // Show success toast
      const id = uuidv4();
      toast({
        id,
        title: "Success",
        description: `Domain deleted successfully`,
      });

      // Invalidate domains query to refresh the list
      queryClient.invalidateQueries({ queryKey: domainKeys.lists() });
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
    success?: boolean;
  }

  return useMutation<
    DomainLookupResponse,
    Error,
    { domainId: string; forceRefresh?: boolean }
  >({
    mutationFn: async ({ domainId, forceRefresh = false }) => {
      // Use the API client for consistent error handling
      return await apiClient.post<DomainLookupResponse>(
        `/api/domains/${domainId}/lookup`,
        { forceRefresh }
      );
    },
    onMutate: async ({ domainId }) => {
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
    onSuccess: (data, { domainId }) => {
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
    onError: (error: Error, params, context: unknown) => {
      // Get domainId from params for error handling and recovery
      const { domainId } = params;

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

      // Invalidate any queries related to this specific domain
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });

      // Check if this is a timeout error
      const isTimeoutError =
        error.message?.includes("timeout") ||
        error.message?.includes("504") ||
        error.message?.includes("Gateway Timeout");

      toast({
        id: uuidv4(),
        title: isTimeoutError ? "Lookup Timeout" : "Refresh Failed",
        description: isTimeoutError
          ? "The domain lookup is taking too long. This can happen with some domain registrars. Please try again later."
          : error.message || "Failed to refresh domain information",
        variant: "destructive",
      });
    },
    onSettled: (data, error, { domainId }) => {
      // Always invalidate queries after settled (success or error)
      queryClient.invalidateQueries({ queryKey: domainKeys.detail(domainId) });
    },
  });
}
