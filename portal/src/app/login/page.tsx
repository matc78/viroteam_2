import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCarousel } from "@/components/auth/AuthCarousel";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { AuthShell } from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Connexion — ViroTeam",
  description:
    "Connecte-toi à l'espace club ViroTeam, rejoins un club avec ton code ou crée ton compte.",
  robots: { index: false, follow: false },
};

/**
 * Page d’authentification unique : connexion, code d’invitation et
 * inscription dans un même carrousel (`?vue=code|signup`).
 */
export default function LoginPage() {
  return (
    <AuthShell variant="stage">
      <Suspense fallback={<AuthLoadingState message="Chargement…" />}>
        <AuthCarousel />
      </Suspense>
    </AuthShell>
  );
}
