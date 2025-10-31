"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

type SidebarContextType = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  activeItem: string | null;
  // Map state: key (parent menu name) -> open/closed
  openMap: Record<string, boolean>;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setActiveItem: (item: string | null) => void;
  toggleGroup: (key: string) => void;
  setGroupOpen: (key: string, open: boolean) => void;
  setOnlyOpen: (key: string) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [activeItem, setActiveItem] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Always close mobile sidebar when route changes to avoid lingering backdrop
  useEffect(() => {
    // Logging untuk verifikasi konsistensi sidebar lintas route
    console.log("[SidebarContext] route changed:", pathname);
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleSidebar = () => {
    setIsExpanded((prev) => !prev);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const toggleGroup = (key: string) => {
    setOpenMap((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      console.log("[SidebarContext] toggleGroup", key, "->", next[key]);
      return next;
    });
  };

  const setGroupOpen = (key: string, open: boolean) => {
    setOpenMap((prev) => {
      if (prev[key] === open) return prev;
      const next = { ...prev, [key]: open };
      console.log("[SidebarContext] setGroupOpen", key, "->", open);
      return next;
    });
  };

  // Exclusively open one group and close others (accordion behavior)
  const setOnlyOpen = (key: string) => {
    setOpenMap((prev) => {
      const next: Record<string, boolean> = {};
      // ensure we keep known keys but mark all closed
      Object.keys(prev).forEach((k) => {
        next[k] = false;
      });
      next[key] = true;
      console.log("[SidebarContext] setOnlyOpen", key);
      return next;
    });
  };

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isMobile ? false : isExpanded,
        isMobileOpen,
        isHovered,
        activeItem,
        openMap,
        toggleSidebar,
        toggleMobileSidebar,
        setIsHovered,
        setActiveItem,
        toggleGroup,
        setGroupOpen,
        setOnlyOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
