import React from "react";

export default function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6">
      <div className="rounded-lg bg-white shadow-sm border p-6">
        {children}
      </div>
    </div>
  );
}
