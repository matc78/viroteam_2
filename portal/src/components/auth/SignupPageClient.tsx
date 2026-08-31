"use client";

import { useSearchParams } from "next/navigation";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { SignupForm } from "@/components/auth/SignupForm";

/** Intro + formulaire inscription (intent fondateur via query). */
export function SignupPageClient() {
  const searchParams = useSearchParams();
  const isFounder = searchParams.get("intent") === "founder";

  return (
    <>
      <AuthPageIntro
        eyebrow="Espace club"
        title="Inscription"
        compact
        lead={
          isFounder
            ? "Crée ton compte administrateur, puis lance la configuration de ton club."
            : "Crée ton compte. L’espace web est réservé aux administrateurs de club."
        }
      />
      <SignupForm />
    </>
  );
}
