"use client"

import { useState, useEffect } from "react"
import { DomainInput } from "@/components/domain-input"
import { AuthDialog } from "@/components/auth/auth-dialog"

export default function Home() {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [authView, setAuthView] = useState<"login" | "register">("register")

  // Listen for auth dialog events
  useEffect(() => {
    const handleToggleAuth = (e: CustomEvent<{ view: "login" | "register" }>) => {
      setAuthView(e.detail.view)
      setIsAuthOpen(true)
    }

    window.addEventListener('toggle-auth', handleToggleAuth as EventListener)
    return () => window.removeEventListener('toggle-auth', handleToggleAuth as EventListener)
  }, [])

  const handleLogin = async (email: string, password: string) => {
    console.log("Login:", { email, password })
    setIsAuthOpen(false)
  }

  const handleRegister = async (email: string, password: string) => {
    console.log("Register:", { email, password })
    setIsAuthOpen(false)
  }

  return (
    <main className="container mx-auto py-8">
      <DomainInput onTrackDomains={() => setIsAuthOpen(true)} />
      <AuthDialog
        isOpen={isAuthOpen}
        onOpenChange={setIsAuthOpen}
        initialView={authView}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </main>
  )
}
