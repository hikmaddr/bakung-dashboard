"use client";

import React, { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "destructive" | "default";
type Size = "sm" | "md" | "lg" | "default";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  loading?: boolean;
  loadingText?: string;
  spinnerPosition?: "start" | "end";
}

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  loadingText,
  spinnerPosition = "start",
  ...props
}: ButtonProps) => {
  const baseClasses = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  const variantClasses: Record<Variant, string> = {
    primary: "bg-brand-500 text-white hover:bg-brand-600",
    secondary: "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-800 dark:text-white/90 dark:hover:bg-gray-700",
    outline:
      "ring-1 ring-inset ring-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300",
    destructive: "bg-error-500 text-white hover:bg-error-600",
    // alias for backward compatibility
    default: "bg-brand-500 text-white hover:bg-brand-600",
  };

  const sizeClasses: Record<Size, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-8 text-base",
    // alias for backward compatibility
    default: "h-10 px-4 text-sm",
  };

  const resolvedVariant = variant === "default" ? "primary" : variant;
  const resolvedSize = size === "default" ? "md" : size;

  const spinnerSize: Record<Size, string> = {
    sm: "h-4 w-4 border-2",
    md: "h-4 w-4 border-2",
    lg: "h-5 w-5 border-2",
    default: "h-4 w-4 border-2",
  };

  const spinner = (
    <span
      className={`inline-flex items-center ${loadingText ? "" : ""}`}
      aria-hidden="true"
    >
      <span
        className={`animate-spin rounded-full border-current border-t-transparent ${spinnerSize[resolvedSize]}`}
      />
    </span>
  );

  return (
    <button
      className={`${baseClasses} ${variantClasses[resolvedVariant]} ${sizeClasses[resolvedSize]} ${className}`}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading && spinnerPosition === "start" ? spinner : null}
      {loading && loadingText ? loadingText : children}
      {loading && spinnerPosition === "end" ? spinner : null}
    </button>
  );
};
