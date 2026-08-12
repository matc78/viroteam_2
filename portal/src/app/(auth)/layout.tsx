import type { ReactNode } from "react";
import { AuthShell } from "@/components/auth/AuthShell";

type AuthLayoutProps = {
  children: ReactNode;
};

/** Layout partagé login / inscription : coquille persistante, contenu animé. */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthShell variant="animated">{children}</AuthShell>;
}
