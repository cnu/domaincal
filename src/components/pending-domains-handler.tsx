"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { PendingDomainsService } from "@/services/pending-domains.service";

export function PendingDomainsHandler() {
  const { data: session } = useSession();
  const { toast } = useToast();

  useEffect(() => {
    const processPendingDomains = async () => {
      if (session?.user) {
        const pendingDomains = PendingDomainsService.getPendingDomains();
        if (pendingDomains.length === 0) return;

        try {
          // Add each pending domain
          for (const domain of pendingDomains) {
            await fetch("/api/domains", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ domain }),
            });
          }

          toast({
            id: "domains-added",
            title: "Domains Added",
            description: `Successfully added ${pendingDomains.length} domain(s) to your account`,
          });

          // Clear pending domains after successful processing
          PendingDomainsService.clearPendingDomains();
        } catch (error) {
          console.error("Error processing pending domains:", error);
          toast({
            id: "domains-error",
            title: "Error",
            description: "Failed to process some pending domains",
            variant: "destructive",
          });
        }
      }
    };

    void processPendingDomains();
  }, [session, toast]);

  return null; // This component doesn't render anything
}
