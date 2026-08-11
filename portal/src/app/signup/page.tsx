import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Inscription — ViroTeam",
  description: "Crée ton compte pour l’espace club ViroTeam.",
};

/** Page d’inscription — UI seule, redirect /home. */
export default function SignupPage() {
  return (
    <AuthShell
      accent="orange"
      eyebrow="Espace club"
      title="Inscription"
      lead="Crée ton compte pour rejoindre l’espace club."
    >
      <SignupForm />
    </AuthShell>
  );
}
