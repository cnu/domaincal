interface LoadingProps {
  message?: string
}

export const Loading = ({ message = "Loading..." }: LoadingProps) => {
  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      role="status"
      aria-label="Loading content"
    >
      <div className="relative h-32 w-32">
        <div className="absolute inset-0 animate-spin rounded-full border-b-2 border-primary"></div>
        <div className="absolute inset-0 animate-pulse rounded-full border-2 border-transparent"></div>
      </div>
      <p className="text-muted-foreground text-sm">{message}</p>
      <span className="sr-only">Loading</span>
    </div>
  )
}
