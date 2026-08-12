import { NextRequest, NextResponse } from "next/server";
import { DevAuthConfigError } from "@/lib/firebase/adminApp";
import { isDevAuthBypassEnabled } from "@/lib/firebase/devAuth";
import { getAdminAuth } from "@/lib/firebase/adminApp";

function isLocalRequest(request: NextRequest): boolean {
  const host = request.headers.get("host") ?? "";
  return (
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/** Émet un custom token Auth en dev (sans limite de tentatives e-mail/mot de passe). */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !isDevAuthBypassEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Localhost uniquement." }, { status: 403 });
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = body.email?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: "E-mail requis." }, { status: 400 });
  }

  try {
    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.getUserByEmail(email);
    const token = await adminAuth.createCustomToken(userRecord.uid);
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Dev auth token error", error);
    if (error instanceof DevAuthConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      {
        error:
          "Impossible d’émettre un token dev. Vérifie FIREBASE_ADMIN_* ou gcloud auth application-default login.",
      },
      { status: 500 },
    );
  }
}
