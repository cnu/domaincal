"use client"

import { useState, useEffect } from "react"
import { DomainInput } from "@/components/domain-input"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { Nav } from "@/components/nav"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string
  email: string
  lastLoginAt: Date
}

interface DomainResponse {
  error?: string
  domains: { error?: string }[]
}

export default function Home() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authView, setAuthView] = useState<"login" | "register">("register")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const { toast } = useToast()

  // Listen for auth dialog events
  useEffect(() => {
    const handleToggleAuth = (e: CustomEvent<{ view: "login" | "register" }>) => {
      setAuthView(e.detail.view)
      setIsAuthOpen(true)
    }

    window.addEventListener('toggle-auth', handleToggleAuth as EventListener)
    return () => window.removeEventListener('toggle-auth', handleToggleAuth as EventListener)
  }, [])

  const handleLogin = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to login")
      }

      const data = await response.json()
      setUser(data.user)
      setIsAuthOpen(false)
      
      const id = uuidv4()
      toast({
        id,
        title: "Success",
        description: "Logged in successfully",
      })
    } catch (error) {
      const id = uuidv4()
      const message = error instanceof Error ? error.message : "Failed to login"
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleRegister = async (email: string, password: string): Promise<void> => {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to register")
      }

      const data = await response.json()
      setUser(data.user)
      setIsAuthOpen(false)
      
      const id = uuidv4()
      toast({
        id,
        title: "Success",
        description: "Registered successfully",
      })
    } catch (error) {
      const id = uuidv4()
      const message = error instanceof Error ? error.message : "Failed to register"
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to logout")
      }

      setUser(null)
      const id = uuidv4()
      toast({
        id,
        title: "Success",
        description: "Logged out successfully",
      })
    } catch (error) {
      const id = uuidv4()
      const message = error instanceof Error ? error.message : "Failed to logout"
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      })
    }
  }

  const handleDomainSubmit = async (domains: string[]) => {
    if (!user) {
      const id = uuidv4()
      toast({
        id,
        title: "Error",
        description: "Please login to track domains",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSubmitting(true)
      const response = await fetch("/api/domains", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ domains, userId: user.id }),
      })

      const data: DomainResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add domains")
      }

      const id = uuidv4()
      toast({
        id,
        title: "Success",
        description: "Domains added successfully",
      })

      // Refresh domains list
      // fetchDomains()
    } catch (error) {
      const id = uuidv4()
      const message = error instanceof Error ? error.message : "Failed to add domains"
      toast({
        id,
        title: "Error",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAuthSuccess = () => {
    setIsAuthOpen(false)
  }

  return (
    <>
      <Nav 
        user={user} 
        onAuthClick={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />
      <main className="container mx-auto px-4 py-8">
        <DomainInput 
          onSubmit={handleDomainSubmit}
          isSubmitting={isSubmitting}
        />
      </main>
      {isAuthOpen && (
        <AuthDialog
          isOpen={isAuthOpen}
          onOpenChange={setIsAuthOpen}
          view={authView}
          onViewChange={setAuthView}
          onSuccess={handleAuthSuccess}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
      )}
    </>
  )
}
