import React, { ReactNode } from "react";
import { Button as BaseButton } from "../button";

interface ButtonProps {
  children: ReactNode;
  size?: "sm" | "md"; // backward-compatible sizes
  variant?: "primary" | "outline"; // backward-compatible variants
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  loading = false,
  loadingText,
}) => {
  const mappedSize = size === "sm" ? "sm" : "md"; // maps to BaseButton sizes
  const mappedVariant = variant; // BaseButton understands "primary" and "outline"

  return (
    <BaseButton
      size={mappedSize as any}
      variant={mappedVariant as any}
      onClick={onClick}
      disabled={disabled || loading}
      loading={loading}
      loadingText={loadingText}
      className={className}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </BaseButton>
  );
};

export default Button;
