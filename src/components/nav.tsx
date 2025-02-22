"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"

interface NavProps {
  user: { email: string } | null
  onAuthClick: () => void
  onLogout: () => void
}

export function Nav({ user, onAuthClick, onLogout }: NavProps) {
  const handleLoginClick = () => {
    // Dispatch event to show login view in auth modal
    window.dispatchEvent(
      new CustomEvent("toggle-auth", { detail: { view: "login" } })
    )
    onAuthClick()
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Logo />
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button 
                variant="ghost" 
                onClick={onLogout}
                aria-label="Logout"
              >
                Logout
              </Button>
            </>
          ) : (
            <Button 
              variant="ghost" 
              onClick={handleLoginClick}
              aria-label="Open login dialog"
            >
              Login
            </Button>
          )}
          <ModeToggle />
        </div>
      </div>
    </nav>
  )
}
