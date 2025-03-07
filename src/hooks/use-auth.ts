import { useMutation } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";

// Login mutation
export const useLogin = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast({
          id: "cred-error",
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }

      return result;
    },
    onSuccess: () => {
      const id = uuidv4();
      toast({
        id,
        title: "Success",
        description: "Logged in successfully",
      });
    },
    onError: (error) => {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to login";
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
};

// Register mutation
export const useRegister = () => {
  const { toast } = useToast();
  const loginMutation = useLogin();

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        toast({
          id: "cred-error",
          title: "Error",
          description: data.error || "Failed to register",
          variant: "destructive",
        });
      }

      return { email, password };
    },
    onSuccess: async ({ email, password }) => {
      // After successful registration, log the user in
      await loginMutation.mutateAsync({ email, password });
    },
    onError: (error) => {
      const id = uuidv4();
      const message =
        error instanceof Error ? error.message : "Failed to register";
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
};
