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
  domains: { error?: string }[];
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
        const error = await response.json();
        throw new Error(error.message || "Failed to register");
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

  const handleDomainSubmit = async (domain: string) => {
    if (!session) {
      setAuthView("register");
      setIsAuthOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });

      const data: DomainResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to track domain");
      }

      const id = uuidv4();
      toast({
        id,
        title: "Success",
        description: "Domain tracking started successfully",
      });
      
      // Trigger domain list refresh
      setRefreshDomainList(prev => prev + 1);
    } catch (error) {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to track domain";
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
