"use client";

import React from "react";
import { Modal } from "./modal";

type ModalConfirmationProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
  className?: string;
};

export const ModalConfirmation: React.FC<ModalConfirmationProps> = ({
  isOpen,
  onClose,
  title = "Konfirmasi",
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  onConfirm,
  loading = false,
  destructive = false,
  className = "max-w-[480px] p-6",
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} className={className}>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{description}</p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`${destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"} rounded-lg px-4 py-2 text-sm font-medium text-white`}
          >
            {loading ? "Memproses…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ModalConfirmation;

