"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Register } from "@/components/auth/register"
import { Login } from "@/components/auth/login"

interface AuthDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialView?: "login" | "register"
  onLogin: (email: string, password: string) => void
  onRegister: (email: string, password: string) => void
}

export function AuthDialog({
  isOpen,
  onOpenChange,
  initialView = "register",
  onLogin,
  onRegister,
}: AuthDialogProps) {
  const [view, setView] = React.useState(initialView)

  // Update view when initialView prop changes
  React.useEffect(() => {
    setView(initialView)
  }, [initialView])

  // Reset view when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setView(initialView)
    }
  }, [isOpen, initialView])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {view === "register" ? "Create an Account" : "Welcome Back"}
          </DialogTitle>
        </DialogHeader>
        {view === "register" ? (
          <div className="space-y-4">
            <Register onRegister={onRegister} />
            <p className="text-center text-sm">
              Already have an account?{" "}
              <button
                onClick={() => setView("login")}
                className="text-primary hover:underline"
              >
                Login here
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Login onLogin={onLogin} />
            <p className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => setView("register")}
                className="text-primary hover:underline"
              >
                Register here
              </button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
