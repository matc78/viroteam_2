import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { JoinRedirectClient } from "./JoinRedirectClient";

export const metadata: Metadata = {
  title: "Rejoindre un club — ViroTeam",
  description: "Accepte ton invitation ViroTeam avec ton code club.",
  robots: { index: false, follow: false },
};

/** Page publique d’acceptation d’invitation (membre ou parent). */
export default function JoinPage() {
  return (
    <Suspense fallback={<AuthLoadingState message="Redirection…" />}>
      <JoinRedirectClient />
    </Suspense>
  );
}
