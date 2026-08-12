import type { Metadata } from "next";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Connexion — ViroTeam",
  description: "Connecte-toi à l'espace club ViroTeam.",
};

/** Page de connexion Firebase Auth. */
export default function LoginPage() {
  return (
    <>
      <AuthPageIntro
        eyebrow="Espace club"
        title="Connexion"
        lead="Accède à l'espace club avec ton e-mail et ton mot de passe."
      />
      <LoginForm />
    </>
  );
}
