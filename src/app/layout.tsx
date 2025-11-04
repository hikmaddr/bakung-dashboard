// File: app/layout.tsx

import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import NextTopLoader from "nextjs-toploader";
// ❌ HAPUS: import { Toaster } from "react-hot-toast"; 

// ✅ TAMBAHKAN: Import Provider yang sudah Anda buat
import { ToastProvider } from "@/context/ToastContext"; 
import { GlobalProvider } from "@/context/AppContext";
import { Analytics } from "@vercel/analytics/react";
import RouteTransition from "@/layout/RouteTransition";


const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bakung Dashboard | HDP Works",
  description: "Multi-brand business management dashboard for HDP Works.",
  openGraph: {
    title: "Bakung Dashboard",
    description: "An integrated system for creative, procurement, and souvenir management.",
  },
  icons: {
    icon: "/branding/favicon-bakung.png",
    shortcut: "/branding/favicon-bakung.png",
    apple: "/branding/favicon-bakung.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        {/* Top progress bar for route changes */}
        <NextTopLoader
          color="#2563eb"
          height={3}
          showSpinner={false}
          zIndex={2000}
        />
        <ThemeProvider>
          <SidebarProvider>
            
            {/* 🌟 WRAP SEMUA CHILDREN DENGAN ToastProvider 🌟 */}
            <ToastProvider>
              <GlobalProvider>
                <div className="container-responsive section-spacing">
                  {children}
                </div>
                {/* Vercel Analytics */}
                <Analytics />
              </GlobalProvider>
            </ToastProvider>

            {/* ❌ HAPUS BAGIAN INI DARI SINI
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "#333",
                  color: "#fff",
                },
              }}
            />
            */}
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
