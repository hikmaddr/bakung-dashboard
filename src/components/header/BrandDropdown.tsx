"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import BrandSwitcher from "./BrandSwitcher";

export default function BrandDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties | undefined>(undefined);

  function toggleDropdown() {
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const padding = 12;
      const minWidth = 260;
      const maxWidth = 320;
      const available = window.innerWidth - padding * 2;
      const width = Math.min(Math.max(minWidth, Math.min(maxWidth, available)), 360);

      const viewportLeft = padding;
      const viewportRight = window.innerWidth - padding - width;
      // Align to the right of trigger by default, but clamp within viewport
      const preferredLeft = Math.round(rect.right - width);
      const left = Math.min(Math.max(preferredLeft, viewportLeft), viewportRight);

      const estimatedHeight = 340; // safe estimate
      const below = Math.round(rect.bottom + 8);
      const viewportBottom = window.innerHeight - padding;
      let top = below;
      if (below + estimatedHeight > viewportBottom) {
        const above = Math.round(rect.top - estimatedHeight - 8);
        top = Math.max(above, padding);
      }

      setMenuStyles({ position: "fixed", top, left, width, zIndex: 60 });
    };
    updatePosition();
    const handler = () => updatePosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isOpen]);

  // Close dropdown on route change to avoid stale positions (optional safety)
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label="Brand Switcher"
      >
        {/* Store/brand icon */}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M3.75 6.25C3.33579 6.25 3 6.58579 3 7V8.5C3 10.4853 4.51472 12 6.5 12C8.48528 12 10 10.4853 10 8.5V7C10 6.58579 9.66421 6.25 9.25 6.25H3.75ZM14 7C14 6.58579 14.3358 6.25 14.75 6.25H20.25C20.6642 6.25 21 6.58579 21 7V8.5C21 10.4853 19.4853 12 17.5 12C15.5147 12 14 10.4853 14 8.5V7ZM5 13.5C5 13.0858 5.33579 12.75 5.75 12.75H9C9.41421 12.75 9.75 13.0858 9.75 13.5V20.25C9.75 20.6642 9.41421 21 9 21H5.75C5.33579 21 5 20.6642 5 20.25V13.5ZM14.25 12.75C13.8358 12.75 13.5 13.0858 13.5 13.5V20.25C13.5 20.6642 13.8358 21 14.25 21H18C18.4142 21 18.75 20.6642 18.75 20.25V13.5C18.75 13.0858 18.4142 12.75 18 12.75H14.25Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        position="fixed"
        style={menuStyles}
        className="flex flex-col w-full max-w-[92vw] rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Brand Aktif</h5>
          <button
            onClick={toggleDropdown}
            className="text-gray-500 transition dropdown-toggle dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Tutup"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <div className="px-1">
          <BrandSwitcher />
        </div>
      </Dropdown>
    </div>
  );
}
