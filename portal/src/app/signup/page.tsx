import { redirect } from "next/navigation";
import { authHref } from "@/lib/auth/authViews";

type SignupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/** Ancienne adresse d’inscription : ouvre la carte « Créer un compte ». */
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  redirect(
    authHref("signup", {
      intent: firstValue(params.intent),
      next: firstValue(params.next),
    }),
  );
}
