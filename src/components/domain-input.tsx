"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface DomainInputProps {
  onTrackDomains: (domains: string[]) => void
}

export function DomainInput({ onTrackDomains }: DomainInputProps) {
  const [domains, setDomains] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const domainList = domains
      .split("\n")
      .map(domain => domain.trim())
      .filter(domain => domain.length > 0)
    onTrackDomains(domainList)
  }

  const placeholder = `Enter domains (one per line):

example.com
mydomain.org
another-domain.net`

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Track Expiry of Multiple Domains in one place</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <Textarea
            value={domains}
            onChange={(e) => setDomains(e.target.value)}
            placeholder={placeholder}
            className="min-h-[200px] font-mono"
          />
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            Track Domains
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
