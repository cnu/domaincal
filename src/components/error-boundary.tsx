"use client"

import { useState, useEffect, ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
}

const ErrorFallback = ({ error, resetError }: { error: Error; resetError: () => void }) => {
  const handleReset = () => {
    resetError()
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4" role="alert">
      <h2 className="text-2xl font-bold text-destructive mb-4">
        Something went wrong!
      </h2>
      <p className="text-muted-foreground mb-4">
        {error?.message || "An unexpected error occurred"}
      </p>
      <Button
        variant="default"
        onClick={handleReset}
        aria-label="Reset and try again"
      >
        Try again
      </Button>
    </div>
  )
}

export const ErrorBoundary = ({ children }: ErrorBoundaryProps) => {
  const [error, setError] = useState<Error | null>(null)

  const handleError = (error: Error) => {
    console.error("Application error:", error)
    setError(error)
  }

  const resetError = () => setError(null)

  useEffect(() => {
    window.onerror = (message, source, lineno, colno, error) => {
      handleError(error || new Error(String(message)))
      return true
    }

    window.onunhandledrejection = (event) => {
      handleError(event.reason)
    }

    return () => {
      window.onerror = null
      window.onunhandledrejection = null
    }
  }, [])

  if (error) return <ErrorFallback error={error} resetError={resetError} />

  return <>{children}</>
}
