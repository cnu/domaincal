"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ThemeOption {
  value: 'light' | 'dark' | 'system'
  label: string
}

const themeOptions: ThemeOption[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export function ModeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState<boolean>(false)

  // After mounting, we have access to the theme
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = React.useCallback((newTheme: ThemeOption['value']) => {
    try {
      setTheme(newTheme)
    } catch (error) {
      console.error('Failed to change theme:', error)
    }
  }, [setTheme])

  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open)
  }, [])

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsOpen(prev => !prev)
    }
  }, [])

  // Prevent hydration mismatch by not rendering anything until mounted
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="w-9 h-9"
        aria-label="Loading theme switcher"
      >
        <span className="animate-pulse">...</span>
      </Button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Change theme, current theme is ${theme || 'system'}`}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <Sun 
            className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" 
            aria-hidden="true"
          />
          <Moon 
            className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            aria-hidden="true"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            className="cursor-pointer"
            aria-label={`Switch to ${option.label} theme`}
            role="menuitem"
            tabIndex={0}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
