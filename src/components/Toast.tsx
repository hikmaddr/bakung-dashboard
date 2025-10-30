"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type ToastProps = {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
};

export default function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-blue-500";

  const toastElement = (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999]">
      <div
        className={`${bgColor} text-white px-4 py-2 rounded-md shadow-lg transition-opacity`}
      >
        {message}
      </div>
    </div>
  );

  const root = document.getElementById("toast-root");
  return root ? createPortal(toastElement, root) : null;
}
