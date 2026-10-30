import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "@/lib/context/app-context";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileBottomBar } from "@/components/layout/mobile-bottom-bar";
import { ViewAsBar } from "@/components/layout/view-as-bar";
import { Suspense } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "PU App — NDC Polling Unit Messaging & Coverage Dashboard",
  description: "Official messaging tree and polling unit coverage dashboard for the NDC campaign.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans flex flex-col md:flex-row">
        <AppProvider>
          <TooltipProvider>
            {/* Desktop Left Sidebar */}
            <Suspense fallback={<div className="w-64 hidden md:block bg-card border-r border-border" />}>
              <Sidebar />
            </Suspense>

            {/* Mobile Header & Main Container */}
            <div className="flex-1 flex flex-col min-w-0">
              <Suspense fallback={<div className="h-14 md:hidden bg-card border-b border-border" />}>
                <MobileNav />
              </Suspense>
              <Suspense fallback={null}>
                <ViewAsBar />
              </Suspense>
              <main className="flex-1 min-w-0 pb-16 md:pb-0">{children}</main>
              <Suspense fallback={null}>
                <MobileBottomBar />
              </Suspense>
            </div>
          </TooltipProvider>
        </AppProvider>
      </body>
    </html>
  );
}
