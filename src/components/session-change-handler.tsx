"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { domainKeys } from "@/hooks/use-domains";
import { createLogger } from "@/lib/logger";

const logger = createLogger("SessionChangeHandler");

/**
 * Component that watches for session changes and clears React Query cache
 * when a user logs in/out to prevent showing previous user's data
 */
export function SessionChangeHandler() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const prevUserId = useRef<string | undefined>(undefined);
  
  useEffect(() => {
    const currentUserId = session?.user?.id as string | undefined;
    
    // If the user ID changed (including login/logout transitions)
    if (prevUserId.current !== currentUserId) {
      logger.info("User session changed, clearing domain cache");
      
      // Clear all domain-related queries
      queryClient.invalidateQueries({ queryKey: domainKeys.all(currentUserId) });
      
      // If the previous user existed, also clear their cache
      if (prevUserId.current) {
        queryClient.invalidateQueries({ queryKey: domainKeys.all(prevUserId.current) });
      }
      
      // Update the previous user ID ref
      prevUserId.current = currentUserId;
    }
  }, [session, queryClient]);

  // This is a headless component (no UI)
  return null;
}
