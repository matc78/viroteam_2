import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Connexion — ViroTeam",
  description: "Connecte-toi à l’espace club ViroTeam.",
};

/** Page de connexion — UI seule, redirect /home. */
export default function LoginPage() {
  return (
    <AuthShell
      accent="cyan"
      eyebrow="Espace club"
      title="Connexion"
      lead="Accède à l’espace club avec ton e-mail et ton mot de passe."
    >
      <LoginForm />
    </AuthShell>
  );
}
