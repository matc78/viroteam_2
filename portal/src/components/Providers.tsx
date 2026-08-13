"use client";

import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { ReactNode } from "react";

/** Providers client (Auth Firebase + toasts) pour le layout racine. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
