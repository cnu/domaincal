"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "../components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import dynamic from "next/dynamic";
import { SessionChangeHandler } from "@/components/session-change-handler";

// Dynamically import ReactQueryDevtools to avoid build issues
const ReactQueryDevtools = dynamic(
  () =>
    process.env.NODE_ENV === "development"
      ? import("@tanstack/react-query-devtools").then(
          (mod) => mod.ReactQueryDevtools
        )
      : Promise.resolve(() => null),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 2,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <SessionChangeHandler />
          <Toaster />
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  );
}
