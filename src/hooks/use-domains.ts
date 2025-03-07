import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import React from "react";

interface Domain {
  id: string;
  name: string;
  domainExpiryDate: string | null;
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
const domainKeys = {
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
};

// Fetch domains with pagination and search
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

// Hook for adding domains
export function useAddDomains() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<DomainSubmitResponse, Error, string[]>({
    mutationFn: async (domains: string[]) => {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (data.totalRequested && data.totalRequested > 20) {
          toast({
            id: "too-many-domains",
            title: "Error",
            description: `Too many domains: ${data.totalRequested}. Maximum allowed is 20.`,
            variant: "destructive",
          });
        }
        toast({
          id: "failed-to-track-domains",
          title: "Error",
          description: data.error || "Failed to track domains",
          variant: "destructive",
        });
      }

      return data as DomainSubmitResponse;
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

      const id = uuidv4();
      toast({
        id,
        title: "Domain Tracking Update",
        description: successMessage || "Domain processing completed",
        variant: "default",
      });

      // If there were specific failures, show them in a separate toast
      if (data.failedDomains && data.failedDomains.length > 0) {
        const failId = uuidv4();
        toast({
          id: failId,
          title: "Failed Domains",
          description: `Failed to process: ${data.failedDomains.join(", ")}`,
          variant: "destructive",
        });
      }

      // Invalidate domains query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
    onError: (error: Error) => {
      const id = uuidv4();
      toast({
        id,
        title: "Error",
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
