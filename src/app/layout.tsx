import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Employee Management System",
  description: "Track employee attendance, leaves, and performance",
  applicationName: "EMS",
  appleWebApp: {
    capable: true,
    title: "EMS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
