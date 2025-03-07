"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { DomainInput } from "@/components/domain-input";
import { DomainList } from "@/components/domain-list";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { Nav } from "@/components/nav";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { useAddDomains } from "@/hooks/use-domains";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const { data: session } = useSession();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<"login" | "register">("register");
  const [refreshDomainList, setRefreshDomainList] = useState(0);
  const { toast } = useToast();
  
  // Use TanStack Query hooks
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const addDomainsMutation = useAddDomains();

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

    try {
      await addDomainsMutation.mutateAsync(domains);
      // Trigger a refresh of the domain list
      setRefreshDomainList(prev => prev + 1);
    } catch (error) {
      // Error handling is done in the mutation
      console.error("Domain submission error:", error);
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
        view={authView}
        onViewChange={setAuthView}
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={loginMutation.isPending || registerMutation.isPending}
      />
    </main>
  );
}
