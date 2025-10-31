"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type FeedbackType = "success" | "error" | "info";

type FeedbackState = {
  open: boolean;
  type: FeedbackType;
  title: string;
  message?: string;
};

type FeedbackContextValue = {
  show: (opts: { type: FeedbackType; title: string; message?: string }) => void;
  close: () => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FeedbackState>({ open: false, type: "info", title: "", message: "" });

  const show = useCallback((opts: { type: FeedbackType; title: string; message?: string }) => {
    setState({ open: true, type: opts.type, title: opts.title, message: opts.message });
  }, []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const icon = state.type === "success" ? (
    <CheckCircle2 className="h-6 w-6 text-green-600" />
  ) : state.type === "error" ? (
    <AlertTriangle className="h-6 w-6 text-red-600" />
  ) : (
    <Info className="h-6 w-6 text-blue-600" />
  );

  const titleClass = state.type === "success" ? "text-green-900" : state.type === "error" ? "text-red-900" : "text-blue-900";
  const borderClass = state.type === "success" ? "border-green-200" : state.type === "error" ? "border-red-200" : "border-blue-200";

  return (
    <FeedbackContext.Provider value={{ show, close }}>
      {children}
      <Modal isOpen={state.open} onClose={close} className="w-[92vw] max-w-md overflow-hidden rounded-3xl shadow-xl">
        <div className={`flex items-start gap-3 border-b px-6 py-4 ${borderClass}`}>
          {icon}
          <div>
            <h3 className={`text-lg font-semibold ${titleClass}`}>{state.title}</h3>
            {state.message && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{state.message}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button onClick={close} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">OK</button>
        </div>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}

