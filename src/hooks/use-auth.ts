import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import { useToast } from "@/components/ui/use-toast";
import { v4 as uuidv4 } from "uuid";
import { apiClient } from "@/lib/api-client";

// Auth mutation keys
export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
  user: () => [...authKeys.all, "user"] as const,
};

interface AuthCredentials {
  email: string;
  password: string;
}

/**
 * Hook for handling user login
 * Uses NextAuth signIn method and handles success/error states
 */
export const useLogin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { update: updateSession } = useSession();

  return useMutation({
    mutationFn: async ({ email, password }: AuthCredentials) => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      return result;
    },
    onSuccess: async () => {
      // Update the session to get the latest data
      await updateSession();

      // Invalidate relevant queries to refresh data after login
      queryClient.invalidateQueries({ queryKey: authKeys.session() });

      toast({
        id: uuidv4(),
        title: "Success",
        description: "Logged in successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        id: uuidv4(),
        title: "Login Failed",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
    },
  });
};

/**
 * Hook for handling user registration
 * Automatically logs the user in after successful registration
 */
export const useRegister = () => {
  const { toast } = useToast();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: AuthCredentials) => {
      const response = await apiClient.post("/api/auth/register", { email, password });
      return { email, password, response };
    },
    onSuccess: async ({ email, password }) => {
      // Invalidate any auth-related queries
      queryClient.invalidateQueries({ queryKey: authKeys.all });

      // After successful registration, log the user in
      await loginMutation.mutateAsync({ email, password });

      toast({
        id: uuidv4(),
        title: "Registration Successful",
        description: "Your account has been created and you're now logged in",
      });
    },
    onError: (error: Error) => {
      toast({
        id: uuidv4(),
        title: "Registration Failed",
        description: error.message || "Failed to register",
        variant: "destructive",
      });
    },
  });
};
