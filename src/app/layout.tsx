// File: app/layout.tsx

import { Outfit } from "next/font/google";
import "./globals.css";

import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
// ❌ HAPUS: import { Toaster } from "react-hot-toast"; 

// ✅ TAMBAHKAN: Import Provider yang sudah Anda buat
import { ToastProvider } from "@/context/ToastContext"; 
import { GlobalProvider } from "@/context/AppContext";


const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata = {
  title: "HDP Works Dashboard",
  description: "Dashboard Admin System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>
            
            {/* 🌟 WRAP SEMUA CHILDREN DENGAN ToastProvider 🌟 */}
            <ToastProvider>
              <GlobalProvider>
                {children}
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
