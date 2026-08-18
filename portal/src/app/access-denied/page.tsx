import type { Metadata } from "next";
import { Suspense } from "react";
import { AccessDeniedContent } from "@/components/auth/AccessDeniedContent";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";

export const metadata: Metadata = {
  title: "Accès réservé — ViroTeam",
  description:
    "Le portail web ViroTeam est réservé aux administrateurs de club.",
  robots: { index: false, follow: false },
};

/** Page d’accès refusé pour joueurs / coachs / comptes sans club admin. */
export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<AuthLoadingState />}>
      <AccessDeniedContent />
    </Suspense>
  );
}
