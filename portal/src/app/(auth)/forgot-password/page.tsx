import type { Metadata } from "next";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { authCopy } from "@/lib/copy/authCopy";

export const metadata: Metadata = {
  title: "Mot de passe oublié — ViroTeam",
  description: "Réinitialise le mot de passe de ton compte ViroTeam.",
};

/** Page d’envoi du lien de réinitialisation du mot de passe. */
export default function ForgotPasswordPage() {
  return (
    <>
      <AuthPageIntro
        eyebrow={authCopy.forgotPasswordEyebrow}
        title={authCopy.forgotPasswordTitle}
        lead={authCopy.forgotPasswordLead}
      />
      <ForgotPasswordForm />
    </>
  );
}
