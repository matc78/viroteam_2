import { NextRequest, NextResponse } from "next/server";
import { site } from "@/lib/site";

const CANONICAL_HOST = new URL(site.url).hostname;
const APEX_HOST = CANONICAL_HOST.replace(/^www\./, "");

/**
 * Redirige l’apex (`viroteam.com`) vers l’hôte canonique (`www`).
 *
 * Sur Firebase App Hosting, le `redirects()` next.config avec `has: host`
 * ne matche pas : le CDN/Cloud Run ne voit pas `Host: viroteam.com`.
 * On lit donc `X-Forwarded-Host` (fallback `Host`).
 */
export function middleware(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const rawHost = (forwardedHost ?? hostHeader ?? "").split(",")[0]?.trim() ?? "";
  const hostname = rawHost.split(":")[0]?.toLowerCase() ?? "";

  if (hostname === APEX_HOST && CANONICAL_HOST !== APEX_HOST) {
    const destination = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      site.url,
    );
    return NextResponse.redirect(destination, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|monitoring|ingest).*)"],
};
