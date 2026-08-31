import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupPageClient } from "@/components/auth/SignupPageClient";

export const metadata: Metadata = {
  title: "Inscription — ViroTeam",
  description: "Crée ton compte pour l’espace club ViroTeam.",
};

/** Page d’inscription Firebase Auth. */
export default function SignupPage() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <SignupPageClient />
    </Suspense>
  );
}
