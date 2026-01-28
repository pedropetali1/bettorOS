"use client";

import * as React from "react";

import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

type ToastItem = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type ToastContextValue = {
  toasts: ToastItem[];
  toast: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (toastId?: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

const TOAST_LIMIT = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((toastId?: string) => {
    setToasts((current) =>
      toastId ? current.filter((toast) => toast.id !== toastId) : []
    );
  }, []);

  const toast = React.useCallback((data: Omit<ToastItem, "id">) => {
    setToasts((current) => {
      const newToast = { ...data, id: crypto.randomUUID() };
      const next = [newToast, ...current].slice(0, TOAST_LIMIT);
      return next;
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
