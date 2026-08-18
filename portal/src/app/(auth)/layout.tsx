import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type AuthLayoutProps = {
  children: ReactNode;
};

/** Layout partagé login / inscription : coquille persistante, contenu animé. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthShell variant="animated">{children}</AuthShell>;
}
