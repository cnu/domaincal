"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Register } from "@/components/auth/register";
import { Login } from "@/components/auth/login";

interface AuthDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentView: "login" | "register";
  onViewChange: (view: "login" | "register") => void;
  onLogin: (email: string, password: string) => void;
  onRegister: (email: string, password: string) => void;
  isLoading?: boolean;
}

export function AuthDialog({
  isOpen,
  onOpenChange,
  currentView = "register",
  onViewChange,
  onLogin,
  onRegister,
  isLoading = false,
}: AuthDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {currentView === "register" ? "Create an Account" : "Welcome Back"}
          </DialogTitle>
        </DialogHeader>
        {currentView === "register" ? (
          <div className="space-y-4">
            <Register onRegister={onRegister} isLoading={isLoading} />
            <p className="text-center text-sm">
              Already have an account?{" "}
              <button
                onClick={() => {
                  // Update parent state first, which will flow down through the view prop
                  onViewChange("login");
                  // No need to update local state directly as it will be updated via the useEffect
                }}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                Login here
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Login onLogin={onLogin} isLoading={isLoading} />
            <p className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  // Update parent state first, which will flow down through the view prop
                  onViewChange("register");
                  // No need to update local state directly as it will be updated via the useEffect
                }}
                className="text-primary hover:underline"
                disabled={isLoading}
              >
                Register here
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
