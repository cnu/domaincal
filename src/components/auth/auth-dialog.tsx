"use client"

import { useState, useEffect } from "react"
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
  view: "login" | "register"
  onViewChange: (view: "login" | "register") => void
  onSuccess: () => void
  onLogin: (email: string, password: string) => void
  onRegister: (email: string, password: string) => void
}

export function AuthDialog({
  isOpen,
  onOpenChange,
  initialView = "register",
  view,
  onViewChange,
  onSuccess,
  onLogin,
  onRegister,
}: AuthDialogProps) {
  const [currentView, setCurrentView] = useState(view)

  // Update view when view prop changes
  useEffect(() => {
    setCurrentView(view)
  }, [view])

  // Reset view when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentView(initialView)
    }
  }, [isOpen, initialView])

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
            <Register
              onRegister={async (email, password) => {
                await onRegister(email, password)
                onSuccess()
              }}
            />
            <p className="text-center text-sm">
              Already have an account?{" "}
              <button
                onClick={() => {
                  setCurrentView("login")
                  onViewChange("login")
                }}
                className="text-primary hover:underline"
              >
                Login here
              </button>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Login
              onLogin={async (email, password) => {
                await onLogin(email, password)
                onSuccess()
              }}
            />
            <p className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setCurrentView("register")
                  onViewChange("register")
                }}
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
