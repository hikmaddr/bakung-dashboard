"use client";

interface LoadingSpinnerProps {
  label?: string;
  minHeight?: string;
  size?: "sm" | "md" | "lg";
  inline?: boolean;
  className?: string;
}

export default function LoadingSpinner({ 
  label = "Memuat data...", 
  minHeight = "min-h-[70vh]", 
  size = "md",
  inline = false,
  className = ""
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2", 
    lg: "h-10 w-10 border-4"
  };

  const spinnerClass = `${sizeClasses[size]} animate-spin rounded-full border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500`;

  if (inline) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={spinnerClass} />
        {label && <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>}
      </div>
    );
  }

  return (
    <div className={`w-full ${minHeight} grid place-items-center ${className}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={spinnerClass} />
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

// Export komponen inline untuk kemudahan
export function InlineSpinner({ 
  label, 
  size = "sm", 
  className = "" 
}: { 
  label?: string; 
  size?: "sm" | "md" | "lg"; 
  className?: string; 
}) {
  return <LoadingSpinner inline label={label} size={size} className={className} />;
}

