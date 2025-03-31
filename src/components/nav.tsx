"use client"

import * as React from "react"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"

export function Nav() {
  const { data: session } = useSession()

  const handleLoginClick = () => {
    window.dispatchEvent(
      new CustomEvent("toggle-auth", { detail: { view: "login" } })
    )
  }

  const handleRegisterClick = () => {
    window.dispatchEvent(
      new CustomEvent("toggle-auth", { detail: { view: "register" } })
    )
  }

  const handleLogout = async () => {
    // Clear all user and domain data from local storage before logout
    localStorage.clear();

    // You can also use more specific clearing if needed:
    // localStorage.removeItem('next-auth.session-token');
    // localStorage.removeItem('domaincal-user-data');
    // localStorage.removeItem('domaincal-domains-data');

    // Log the user out
    await signOut({ redirect: false })
  }

  return (
    <nav>
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
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={handleLoginClick}
                aria-label="Open login dialog"
              >
                Login
              </Button>
              <Button
                variant="default"
                onClick={handleRegisterClick}
                aria-label="Open register dialog"
              >
                Register
              </Button>
            </div>
          )}
          <ModeToggle />
        </div>
      </div>
    </nav>
  )
}
