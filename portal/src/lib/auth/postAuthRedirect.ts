/**
 * Logique pure des redirections d’authentification : `next` du login,
 * classement des destinations et équivalents famille des liens bureau.
 * Sans dépendance React / Firebase (testée par vitest).
 */

/** Origine fictive pour vérifier qu’un chemin reste sur le portail. */
const SAME_ORIGIN_PROBE = "https://portal.viroteam.invalid";

/** Racines de l’espace club (bureau), deep links compris. */
const BUREAU_ROUTE_ROOTS = [
  "/home",
  "/my-planning",
  "/standings",
  "/club-standings",
  "/members",
  "/teams",
  "/attendance",
  "/planning",
  "/fees",
  "/announcements",
  "/team",
  "/equipment",
  "/settings",
  "/account",
  "/messages",
  "/activity",
] as const;

/** Paramètres de deep link transmis vers l’espace famille (hors messagerie). */
const FAMILY_FORWARDED_PARAMS = ["clubId", "memberId", "eventId"] as const;

/** Route bureau → route famille équivalente (parent sans fiche membre). */
const FAMILY_EQUIVALENTS: ReadonlyArray<{ bureau: string; family: string }> = [
  { bureau: "/home", family: "/family" },
  { bureau: "/my-planning", family: "/family/my-planning" },
  { bureau: "/standings", family: "/family/standings" },
  { bureau: "/planning", family: "/family/planning" },
  { bureau: "/fees", family: "/family/fees" },
  { bureau: "/team", family: "/family/team" },
  { bureau: "/account", family: "/family/settings" },
];

/** Catégorie d’une destination `next`. */
export type NextPathKind = "bureau" | "family" | "join" | "clubSetup" | "other";

function isPathOrChild(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * True si `path` est un chemin interne sûr (pas d’open redirect) :
 * commence par un seul `/`, sans `\`, sans caractère de contrôle, et reste
 * sur la même origine une fois résolu.
 */
export function isSafeRedirect(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("\\")) return false;
  // Refuse explicitement les caractères de contrôle.
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  try {
    const resolved = new URL(path, SAME_ORIGIN_PROBE);
    return resolved.origin === SAME_ORIGIN_PROBE;
  } catch {
    return false;
  }
}

/** Partie chemin d’une URL relative (sans query ni fragment). */
export function pathnameOf(path: string): string {
  const end = path.search(/[?#]/);
  return end === -1 ? path : path.slice(0, end);
}

/** Classe une destination `next` déjà validée par `isSafeRedirect`. */
export function classifyNextPath(path: string): NextPathKind {
  const pathname = pathnameOf(path);
  if (isPathOrChild(pathname, "/family")) return "family";
  if (isPathOrChild(pathname, "/join")) return "join";
  if (isPathOrChild(pathname, "/club-setup")) return "clubSetup";
  if (BUREAU_ROUTE_ROOTS.some((root) => isPathOrChild(pathname, root))) {
    return "bureau";
  }
  return "other";
}

/**
 * URL de login conservant la page demandée (chemin + query string).
 * `search` accepte la forme `?a=b` ou `a=b`.
 */
export function buildLoginRedirect(pathname: string, search = ""): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const target = query ? `${pathname}?${query}` : pathname;
  return `/login?next=${encodeURIComponent(target)}`;
}

/**
 * Équivalent famille d’un lien bureau (push `/fees?clubId=`, `/planning?…`)
 * pour un parent sans fiche membre ; null si aucun équivalent.
 * Messagerie : tous les paramètres sont conservés ; ailleurs seulement
 * `clubId`, `memberId` et `eventId`.
 */
export function familyEquivalentPath(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  if (isPathOrChild(pathname, "/messages")) {
    const query = searchParams.toString();
    return query ? `/family/messages?${query}` : "/family/messages";
  }
  const match = FAMILY_EQUIVALENTS.find(({ bureau }) =>
    isPathOrChild(pathname, bureau),
  );
  if (!match) return null;
  const forwarded = new URLSearchParams();
  for (const key of FAMILY_FORWARDED_PARAMS) {
    const value = searchParams.get(key)?.trim();
    if (value) forwarded.set(key, value);
  }
  const query = forwarded.toString();
  return query ? `${match.family}?${query}` : match.family;
}

/** Contexte d’accès utile au choix de la destination après connexion. */
export type PostAuthAccess = {
  isBureauUser: boolean;
  isParent: boolean;
};

/**
 * Destination après connexion à partir du paramètre `next`, ou null pour
 * retomber sur l’atterrissage par défaut. Un lien bureau ouvert par un
 * parent sans fiche est converti vers son équivalent famille.
 */
export function resolveNextRedirect(
  nextPath: string | null | undefined,
  access: PostAuthAccess,
): string | null {
  if (!isSafeRedirect(nextPath)) return null;
  const kind = classifyNextPath(nextPath);
  switch (kind) {
    case "clubSetup":
    case "join":
      return nextPath;
    case "family":
      return access.isParent ? nextPath : null;
    case "bureau": {
      if (access.isBureauUser) return nextPath;
      if (!access.isParent) return null;
      const queryStart = nextPath.indexOf("?");
      const params = new URLSearchParams(
        queryStart === -1 ? "" : nextPath.slice(queryStart + 1).split("#")[0],
      );
      return familyEquivalentPath(pathnameOf(nextPath), params);
    }
    default:
      return null;
  }
}
