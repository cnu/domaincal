"use client"

import * as React from "react"
import { ModeToggle } from "@/components/mode-toggle"

export function HeaderActions() {
  const handleLoginClick = () => {
    window.dispatchEvent(new CustomEvent('toggle-auth', { detail: { view: 'login' } }))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleLoginClick()
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={handleLoginClick}
        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent hover:text-accent-foreground h-9 px-4"
        aria-label="Open login dialog"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        Login
      </button>
      <ModeToggle />
    </div>
  )
}
