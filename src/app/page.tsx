"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { DomainInput } from "@/components/domain-input";
import { DomainList } from "@/components/domain-list";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Nav } from "@/components/nav";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

interface DomainResponse {
  error?: string;
  message?: string;
  domains: Array<{
    id: string;
    name: string;
    domainExpiryDate: string | null;
    createdAt: string;
    updatedAt: string | null;
  }>;
  added?: number;
  skipped?: number;
  failed?: number;
  failedDomains?: string[];
  duplicateDomains?: string[];
  totalRequested?: number;
  uniqueRequested?: number;
}

export default function Home() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register">("register");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshDomainList, setRefreshDomainList] = useState(0);
  const { toast } = useToast();

  // Listen for auth dialog events
  useEffect(() => {
    const handleToggleAuth = (
      e: CustomEvent<{ view: "login" | "register" }>
    ) => {
      setAuthView(e.detail.view);
      setIsAuthOpen(true);
    };

    window.addEventListener("toggle-auth", handleToggleAuth as EventListener);
    return () =>
      window.removeEventListener(
        "toggle-auth",
        handleToggleAuth as EventListener
      );
  }, []);

  const handleLogin = async (
    email: string,
    password: string
  ): Promise<void> => {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      setIsAuthOpen(false);

      const id = uuidv4();
      toast({
        id,
        title: "Success",
        description: "Logged in successfully",
      });
    } catch (error) {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to login";
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error; // Re-throw to prevent onSuccess from being called
    }
  };

  const handleRegister = async (
    email: string,
    password: string
  ): Promise<void> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to register");
      }

      // After successful registration, log the user in
      await handleLogin(email, password);
    } catch (error) {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to register";
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      });
      throw error; // Re-throw to prevent onSuccess from being called
    }
  };

  const handleDomainSubmit = async (domains: string[]) => {
    if (!session) {
      setAuthView("register");
      setIsAuthOpen(true);
      return;
    }

    // Log the domains being submitted
    console.log(`Submitting ${domains.length} domains:`, domains);

    if (domains.length > 20) {
      const id = uuidv4();
      toast({
        id,
        title: "Error",
        description: `Too many domains: ${domains.length}. Maximum allowed is 20.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });

      const data: DomainResponse = await response.json();
      console.log("API response:", data);

      if (!response.ok) {
        // Handle specific error cases
        if (data.totalRequested && data.totalRequested > 20) {
          throw new Error(
            `Too many domains: ${data.totalRequested}. Maximum allowed is 20.`
          );
        }
        throw new Error(data.error || "Failed to track domains");
      }

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

      // Trigger domain list refresh if any domains were added
      if (data.added && data.added > 0) {
        setRefreshDomainList((prev) => prev + 1);
      }
    } catch (error) {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to track domains";
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Nav onAuthClick={() => setIsAuthOpen(true)} />
      <main className="container mx-auto px-4 py-8">
        <DomainInput onSubmit={handleDomainSubmit} isLoading={isSubmitting} />
        <DomainList refreshTrigger={refreshDomainList} />
      </main>
      <AuthDialog
        isOpen={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        view={authView}
        onViewChange={setAuthView}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onSuccess={() => setIsAuthOpen(false)}
        initialView="register"
      />
    </div>
  );
}
