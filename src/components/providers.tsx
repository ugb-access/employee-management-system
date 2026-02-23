'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from 'next-themes'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </NextAuthSessionProvider>
  )
}
