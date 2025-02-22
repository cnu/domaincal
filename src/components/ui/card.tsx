import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Base interface for all card components
 */
interface CardBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Additional className to be merged with the default styles
   */
  className?: string
}

/**
 * Main Card component that serves as a container
 * @component
 */
const Card = React.forwardRef<HTMLDivElement, CardBaseProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow transition-shadow hover:shadow-lg",
        className
      )}
      role="article"
      {...props}
    />
  )
)
Card.displayName = "Card"

/**
 * Card header component for title and description
 * @component
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardBaseProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

/**
 * Card title component
 * @component
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

/**
 * Card description component
 * @component
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * Card content component
 * @component
 */
const CardContent = React.forwardRef<HTMLDivElement, CardBaseProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("p-6 pt-0", className)}
      role="region"
      {...props}
    />
  )
)
CardContent.displayName = "CardContent"

/**
 * Card footer component
 * @component
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardBaseProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      role="contentinfo"
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  type CardBaseProps,
}
