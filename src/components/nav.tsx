"use client"

import * as React from "react"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"

interface NavProps {
  onAuthClick: () => void
}

export function Nav({ onAuthClick }: NavProps) {
  const { data: session } = useSession()

  const handleLoginClick = () => {
    window.dispatchEvent(
      new CustomEvent("toggle-auth", { detail: { view: "login" } })
    )
    onAuthClick()
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
  }

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Logo />
        <div className="flex items-center gap-4">
          {session?.user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.email}
              </span>
              <Button 
                variant="ghost" 
                onClick={handleLogout}
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
