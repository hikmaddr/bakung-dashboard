"use client";

import React from "react";
import Image from "next/image";

interface EmptyStateProps {
  title: string;
  description: string;
  imageSrc?: string;
  actions?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  imageSrc = "/empty-state.svg",
  actions,
}) => {
  return (
    <div className="flex flex-col items-center justify-center mt-20 text-center text-gray-600">
      <Image
        src={imageSrc}
        alt="Empty State Illustration"
        width={256}
        height={256}
        className="mb-4 opacity-90"
      />
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm mt-2 max-w-md">{description}</p>
      {actions && <div className="mt-4 flex gap-2">{actions}</div>}
    </div>
  );
};

export default EmptyState;
