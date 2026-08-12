"use client";

import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { ReactNode } from "react";

/** Providers client (Auth Firebase) pour le layout racine. */
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
