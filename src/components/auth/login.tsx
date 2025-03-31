"use client"

import { useState, FormEvent, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { useSearchParams } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

interface LoginProps {
  onLogin: (email: string, password: string) => void
  isLoading?: boolean
}

export function Login({ onLogin, isLoading = false }: LoginProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showVerificationSuccess, setShowVerificationSuccess] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('verified') === 'true') {
      setShowVerificationSuccess(true)
      // Hide the message after 5 seconds
      const timer = setTimeout(() => setShowVerificationSuccess(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onLogin(email, password)
  }

  return (
    <Card className="w-full max-w-md mx-auto py-4">
      {showVerificationSuccess && (
        <div className="px-6 pb-4">
          <Alert className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              Email verified successfully! Please sign in to continue.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
