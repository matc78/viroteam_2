import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { JoinRedirectClient } from "./JoinRedirectClient";

export const metadata: Metadata = {
  title: "Rejoindre un club — ViroTeam",
  description: "Ouvre l’app ViroTeam avec ton code d’invitation.",
};

/** Page publique de redirection vers l’app mobile. */
export default function JoinPage() {
  return (
    <Suspense fallback={<AuthLoadingState message="Redirection…" />}>
      <JoinRedirectClient />
    </Suspense>
  );
}
