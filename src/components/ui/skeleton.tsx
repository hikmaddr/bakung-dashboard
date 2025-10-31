"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-800 ${className}`} />
  );
}

