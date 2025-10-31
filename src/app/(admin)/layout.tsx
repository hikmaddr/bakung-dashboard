"use client";

import React from "react";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import Backdrop from "@/components/layout/Backdrop";
import { ThemeProvider } from "@/context/ThemeContext";
import { FeedbackProvider } from "@/context/FeedbackContext";
import IdleWatcher from "@/components/IdleWatcher";
import BrandSelectOnLogin from "@/components/header/BrandSelectOnLogin";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
    ? "lg:ml-[290px]"
    : "lg:ml-[90px]";

  return (
    <ThemeProvider>
        <FeedbackProvider>
        <div className="min-h-screen xl:flex">
          {/* Sidebar */}
          <AppSidebar />

          {/* Backdrop (untuk mobile sidebar) */}
          <Backdrop />

          {/* Main Content Area */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${mainContentMargin}`}
          >
            {/* Idle auto-logout watcher */}
            <IdleWatcher />
            {/* Brand selection modal on login if multiple brands */}
            <BrandSelectOnLogin />
            {/* Header */}
            <AppHeader />

            {/* Page Content */}
            <main className="p-4 md:p-6 max-w-[--breakpoint-2xl] mx-auto w-full">
              {children}
            </main>
          </div>
        </div>
        </FeedbackProvider>
    </ThemeProvider>
  );
}
