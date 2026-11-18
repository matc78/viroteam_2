import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { authHref } from "@/lib/auth/authViews";
import { JoinRedirectClient } from "./JoinRedirectClient";

export const metadata: Metadata = {
  title: "Rejoindre un club — ViroTeam",
  description: "Accepte ton invitation ViroTeam avec ton code club.",
  robots: { index: false, follow: false },
};

type JoinPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Page publique d’acceptation d’invitation (membre ou parent). Sans code,
 * ouvre la carte « J’ai un code » de la page d’authentification.
 */
export default async function JoinPage({ searchParams }: JoinPageProps) {
  const params = await searchParams;
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  if (!code?.trim()) redirect(authHref("code"));

  return (
    <Suspense fallback={<AuthLoadingState message="Redirection…" />}>
      <JoinRedirectClient />
    </Suspense>
  );
}
