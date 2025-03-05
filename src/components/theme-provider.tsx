"use client"

import { ReactNode } from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type ThemeProviderProps = {
  children: ReactNode
} & Parameters<typeof NextThemesProvider>[0]

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
