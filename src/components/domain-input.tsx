"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { v4 as uuidv4 } from 'uuid'

interface DomainInputProps {
  onSubmit: (domains: string[]) => Promise<void>
  isSubmitting: boolean
}

export function DomainInput({ onSubmit, isSubmitting }: DomainInputProps) {
  const [value, setValue] = useState("")
  const { toast } = useToast()

  const placeholder = `Enter domains (one per line), for example:
example.com
mydomain.org
another-domain.net`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const domains = value.split("\n").map(d => d.trim()).filter(Boolean)
    
    if (domains.length === 0) {
      const id = uuidv4()
      toast({
        id,
        title: "Error",
        description: "Please enter at least one domain",
        variant: "destructive",
      })
      return
    }

    // Check for domains with spaces
    const invalidDomains = domains.filter(d => d.includes(" "))
    if (invalidDomains.length > 0) {
      const id = uuidv4()
      toast({
        id,
        title: "Error",
        description: "Domains cannot contain spaces",
        variant: "destructive",
      })
      return
    }

    try {
      await onSubmit(domains)
      setValue("")
    } catch {
      const id = uuidv4()
      toast({
        id,
        title: "Error",
        description: "Failed to add domains",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Track Expiry of Multiple Domains in one place</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
      <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
          className="font-mono"
        />
        <Button 
        type="submit"
          onClick={handleSubmit} 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding..." : "Track Domains"}
        </Button>
      </CardContent>
    </Card>
  )
}
