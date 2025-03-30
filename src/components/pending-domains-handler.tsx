"use client";

import React, { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { PendingDomainsService } from "@/services/pending-domains.service";
import { useQueryClient } from "@tanstack/react-query";
import { domainKeys } from "@/hooks/use-domains";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PendingDomainsHandler");

export function PendingDomainsHandler(): React.ReactNode {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const processPendingDomains = async () => {
      if (session?.user) {
        const pendingDomains = PendingDomainsService.getPendingDomains();
        logger.info(`Found ${pendingDomains.length} pending domains for newly logged in user`);
        if (pendingDomains.length === 0) return;

        try {
          // Process all pending domains in one batch for better performance
          const response = await fetch("/api/domains", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domains: pendingDomains }),
          });
          
          if (!response.ok) {
            throw new Error(`Failed to add domains: ${response.statusText}`);
          }

          toast({
            id: "domains-added",
            title: "Domains Added",
            description: `Successfully added ${pendingDomains.length} domain(s) to your account`,
          });

          // Clear pending domains after successful processing
          PendingDomainsService.clearPendingDomains();

          // Force a complete cache reset for this user to ensure fresh data
          const userId = session?.user?.id as string | undefined;
          logger.info(
            "Invalidating all domain queries after adding pending domains"
          );
          
          // Invalidate all domain-related queries for this user
          queryClient.invalidateQueries({ queryKey: domainKeys.all(userId) });
          
          // Force refetch to ensure UI updates
          queryClient.refetchQueries({ queryKey: domainKeys.lists(userId) });
        } catch (error) {
          logger.error("Error processing pending domains:", error);
          
          // Don't clear pending domains on error so they can be retried
          toast({
            id: "domains-error",
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to process pending domains",
            variant: "destructive",
          });
        }
      }
    };

    void processPendingDomains();
  }, [session, toast, queryClient]);

  return null; // This component doesn't render anything
}
