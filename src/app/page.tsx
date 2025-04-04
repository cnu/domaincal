"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { DomainInput } from "@/components/domain-input";
import { DomainList } from "@/components/domain-list";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Nav } from "@/components/nav";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { useAddDomains } from "@/hooks/use-domains";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

function HomeContent() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register">("register");
  const [refreshDomainList, setRefreshDomainList] = useState(0);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // Use TanStack Query hooks
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const addDomainsMutation = useAddDomains();

  // Check for verified parameter and remove it after showing toast
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      // Show success toast
      toast({
        id: uuidv4(),
        title: "Email Verified",
        description: "Your email has been verified successfully!",
        variant: "default",
      });

      // Replace URL without the verified parameter to clean it up
      // Use setTimeout to ensure the toast is displayed before the URL changes
      const timeoutId = setTimeout(() => {
        window.history.replaceState({}, "", window.location.pathname);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams, toast]);

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
      await loginMutation.mutateAsync({ email, password });
      setIsAuthOpen(false);
      // Trigger a refresh of the domain list after login
      setRefreshDomainList((prev) => prev + 1);
    } catch (error) {
      // Error handling is done in the mutation
      throw error; // Re-throw to prevent onSuccess from being called
    }
  };

  const handleRegister = async (
    email: string,
    password: string
  ): Promise<void> => {
    try {
      await registerMutation.mutateAsync({ email, password });
      setIsAuthOpen(false);
      // Trigger a refresh of the domain list after registration
      setRefreshDomainList((prev) => prev + 1);
    } catch (error) {
      // Error handling is done in the mutation
      throw error; // Re-throw to prevent onSuccess from being called
    }
  };

  const handleDomainSubmit = async (domains: string[]) => {
    if (!session) {
      setAuthView("register");
      setIsAuthOpen(true);
      return;
    }

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

    try {
      await addDomainsMutation.mutateAsync(domains);
      // Trigger a refresh of the domain list
      setRefreshDomainList((prev) => prev + 1);
    } catch {
      // Error handling is done in the mutation
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Nav />
      <div className="grid gap-8">
        <DomainInput
          onSubmit={handleDomainSubmit}
          isLoading={addDomainsMutation.isPending}
        />
        <DomainList refreshTrigger={refreshDomainList} />
      </div>

      <AuthDialog
        isOpen={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        currentView={authView}
        onViewChange={setAuthView}
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={loginMutation.isPending || registerMutation.isPending}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
