"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid'

interface DomainInputProps {
  onSubmit: (domain: string) => Promise<void>
  isLoading: boolean
}

export function DomainInput({ onSubmit, isLoading }: DomainInputProps) {
  const { toast } = useToast()
  const [value, setValue] = React.useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const domain = value.trim()
    
    if (!domain) {
      toast({
        id: uuidv4(),
        title: "Error",
        description: "Please enter a domain",
        variant: "destructive",
      })
      return
    }

    if (domain.includes(" ")) {
      toast({
        id: uuidv4(),
        title: "Error",
        description: "Domain cannot contain spaces",
        variant: "destructive",
      })
      return
    }

    try {
      await onSubmit(domain)
      setValue("")
    } catch (error) {
      // Error will be handled by the parent component
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-center">
          Track Domain Expiry
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            id="domain-input"
            name="domain"
            placeholder="Enter a domain (e.g., example.com)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            className="font-mono resize-none"
            aria-label="Domain name input"
            disabled={isLoading}
          />
          <Button 
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-label={isLoading ? "Adding domain..." : "Track domain"}
          >
            {isLoading ? "Adding..." : "Track Domain"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
