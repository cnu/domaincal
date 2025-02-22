import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModeToggle } from "@/components/mode-toggle"

export default function Home() {
  return (
    <main className="container py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Welcome to DomainCal</CardTitle>
          <CardDescription>
            A modern calendar app built with Next.js and shadcn/ui components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This application includes everything you need for domain-driven calendar management:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-muted-foreground">
            <li>Next.js 14 with App Router</li>
            <li>Radix UI Primitives</li>
            <li>shadcn/ui Components</li>
            <li>Tailwind CSS</li>
            <li>Dark mode with next-themes</li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button>Get Started</Button>
        </CardFooter>
      </Card>
    </main>
  )
}
