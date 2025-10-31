"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";

type AvatarProps = {
  src?: string | null;
  alt?: string;
  name?: string | null;
  size?: number; // pixel size, square
  className?: string;
};

function getInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "?";
  const value = String(nameOrEmail).trim();
  // If email, take local part
  const local = value.includes("@") ? value.split("@")[0] : value;
  const parts = local.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return local.charAt(0).toUpperCase();
  const first = parts[0].charAt(0).toUpperCase();
  const second = parts.length > 1 ? parts[1].charAt(0).toUpperCase() : "";
  return `${first}${second}` || first;
}

function stableColorFromString(seed?: string | null) {
  const s = (seed || "?").toString();
  // Simple hash to derive hue
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  // Pastel background, darker text
  const bg = `hsl(${hue}, 60%, 85%)`;
  const fg = `hsl(${hue}, 40%, 25%)`;
  return { bg, fg };
}

export const Avatar: React.FC<AvatarProps> = ({ src, alt, name, size = 44, className }) => {
  const [error, setError] = useState(false);
  const showImage = Boolean(src) && !error;
  const initials = useMemo(() => getInitials(name || alt), [name, alt]);
  const colors = useMemo(() => stableColorFromString(name || alt), [name, alt]);

  const wrapperStyle: React.CSSProperties = { width: size, height: size, backgroundColor: showImage ? undefined : colors.bg };
  const fontSize = Math.max(12, Math.floor(size * 0.4));

  return (
    <span
      className={`overflow-hidden rounded-full inline-flex items-center justify-center border border-gray-200 dark:border-gray-800 ${className || ""}`}
      style={wrapperStyle}
    >
      {showImage ? (
        <Image
          width={size}
          height={size}
          src={src as string}
          alt={alt || initials}
          onError={() => setError(true)}
        />
      ) : (
        <span
          className="w-full h-full flex items-center justify-center"
          style={{ fontSize, lineHeight: `${size}px`, color: colors.fg }}
          aria-label={alt || initials}
        >
          {initials}
        </span>
      )}
    </span>
  );
};

export default Avatar;
