import type { Metadata } from "next";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Inscription — ViroTeam",
  description: "Crée ton compte pour l’espace club ViroTeam.",
};

/** Page d’inscription Firebase Auth. */
export default function SignupPage() {
  return (
    <>
      <AuthPageIntro
        eyebrow="Espace club"
        title="Inscription"
        lead="Crée ton compte. L’espace web est réservé aux administrateurs de club."
      />
      <SignupForm />
    </>
  );
}
