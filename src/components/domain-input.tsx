"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import { addPendingDomain } from "@/lib/pending-domains";
import { useSession } from "next-auth/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface DomainInputProps {
  onSubmit: (domains: string[]) => Promise<void>;
  isLoading: boolean;
}

const MAX_DOMAINS = 20;

export function DomainInput({ onSubmit, isLoading }: DomainInputProps) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { data: session } = useSession();

  // Parse and validate domains from the input
  const parseDomains = useCallback(
    (input: string): { domains: string[]; errors: string[] } => {
      // Split by newlines or commas
      const rawDomains = input
        .split(/[\n,]+/)
        .map((d) => d.trim())
        .filter(Boolean); // Remove empty entries

      const uniqueDomains = new Set<string>();
      const errors: string[] = [];
      const validDomains: string[] = [];

      // Check maximum domains limit first - this is a hard limit
      if (rawDomains.length > MAX_DOMAINS) {
        errors.push(
          `Maximum ${MAX_DOMAINS} domains allowed per submission. You entered ${rawDomains.length}.`
        );
        // Don't return any domains if over the limit
        return {
          domains: [],
          errors,
        };
      }

      for (const domain of rawDomains) {
        // Check for valid domain format
        if (!validateDomain(domain)) {
          errors.push(`Invalid domain format: ${domain}`);
          continue;
        }

        // Check for duplicates
        if (uniqueDomains.has(domain)) {
          continue; // Skip duplicates silently
        }

        uniqueDomains.add(domain);
        validDomains.push(domain);
      }

      return {
        domains: validDomains,
        errors,
      };
    },
    []
  );

  // Validate a single domain
  const validateDomain = (domain: string): boolean => {
    if (!domain || domain.includes(" ") || !domain.includes(".")) return false;

    try {
      // Basic URL validation
      new URL(`http://${domain}`);
      return true;
    } catch {
      return false;
    }
  };

  // Get current domain count
  const getDomainCount = (): number => {
    if (!value.trim()) return 0;

    return value
      .split(/[\n,]+/)
      .map((d) => d.trim())
      .filter(Boolean).length;
  };

  // Live validation as user types
  useEffect(() => {
    if (!value.trim()) {
      setValidationError(null);
      return;
    }

    const { errors } = parseDomains(value);

    if (errors.length > 0) {
      setValidationError(errors[0]);
    } else {
      setValidationError(null);
    }
  }, [value, parseDomains]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!value.trim()) {
      toast({
        id: uuidv4(),
        title: "Error",
        description: "Please enter at least one domain",
        variant: "destructive",
      });
      return;
    }

    // Get domain count first to check if over limit
    const domainCount = getDomainCount();

    if (domainCount > MAX_DOMAINS) {
      toast({
        id: uuidv4(),
        title: "Validation Error",
        description: `Maximum ${MAX_DOMAINS} domains allowed per submission. You entered ${domainCount}.`,
        variant: "destructive",
      });
      return;
    }

    const { domains, errors } = parseDomains(value);

    if (errors.length > 0) {
      toast({
        id: uuidv4(),
        title: "Validation Error",
        description: errors[0],
        variant: "destructive",
      });
      return;
    }

    if (domains.length === 0) {
      toast({
        id: uuidv4(),
        title: "Error",
        description: "No valid domains found",
        variant: "destructive",
      });
      return;
    }

    try {
      if (!session) {
        // Store all domains in localStorage for anonymous users
        domains.forEach((domain) => addPendingDomain(domain));
        setValue("");

        // Dispatch custom event to open auth dialog
        const event = new CustomEvent("toggle-auth", {
          detail: { view: "register" },
        });
        window.dispatchEvent(event);
        return;
      }

      await onSubmit(domains);
      setValue("");
    } catch (error) {
      toast({
        id: uuidv4(),
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to add domains",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-center">
          Track Domain Expiry
        </CardTitle>
        <CardDescription className="text-center">
          Enter up to <span className="font-medium">{MAX_DOMAINS} domains</span>
          , one per line or separated by commas.
          <span className="block mt-1 text-xs">
            The system will <span className="font-semibold">not process</span>{" "}
            submissions with more than {MAX_DOMAINS} domains.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="domain-input" className="text-sm font-medium">
                Domains
              </label>
              <span
                className={`text-xs ${
                  getDomainCount() > MAX_DOMAINS
                    ? "text-destructive font-bold"
                    : getDomainCount() >= MAX_DOMAINS * 0.8
                    ? "text-amber-500 font-medium"
                    : "text-muted-foreground"
                }`}
              >
                {getDomainCount()}/{MAX_DOMAINS} domains{" "}
                {getDomainCount() > MAX_DOMAINS
                  ? "(too many!)"
                  : getDomainCount() >= MAX_DOMAINS * 0.8
                  ? "(approaching limit)"
                  : ""}
              </span>
            </div>

            <Textarea
              id="domain-input"
              name="domain"
              placeholder={`Enter domains (e.g., example.com, domain.org)
Or one domain per line`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={5}
              className="font-mono resize-none focus:border-primary focus:ring-1 focus:ring-primary"
              aria-label="Domain names input"
              disabled={isLoading}
            />
          </div>

          {validationError && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading || (validationError !== null && value.trim() !== "")
            }
            aria-label={isLoading ? "Adding domains..." : "Track domains"}
          >
            {isLoading ? "Adding..." : "Track Domains"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
