"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { PageLoadOverlay } from "@/components/common/PageLoadOverlay";
import {
  useAuth,
  type PortalSpace,
} from "@/lib/firebase/AuthProvider";

/** Délai mini pour qu’un voile soit perceptible. */
const MIN_VISIBLE_MS = 200;

/** Filet de sécurité si une page ne signale jamais ready. */
const SAFETY_TIMEOUT_MS = 12_000;

type PageLoadOptions = {
  clubId?: string;
  space?: PortalSpace;
  /**
   * Si true (défaut pour les appels explicites), attend `markPageReady`.
   * Si false (nav automatique), le voile tombe dès que la route est alignée.
   */
  awaitContent?: boolean;
};

type PendingPageLoad = {
  href: string;
  clubId?: string;
  space?: PortalSpace;
  startedAt: number;
  awaitContent: boolean;
  /** True une fois que la page cible a fini son chargement de données. */
  contentReady: boolean;
};

type PageLoadContextValue = {
  /** Cible de navigation en cours (styles nav pending). */
  pendingHref: string | null;
  /** Démarre le voile plein écran jusqu’à route + contenu prêts. */
  beginPageLoad: (href: string, options?: PageLoadOptions) => void;
  /** Signale que le contenu de la page cible est prêt à s’afficher. */
  markPageReady: () => void;
};

const PageLoadContext = createContext<PageLoadContextValue | null>(null);

/** Normalise un href (query/hash) en pathname pour le matching de route. */
export function normalizePagePath(href: string): string {
  const trimmed = href.trim();
  if (!trimmed) return "/";
  try {
    const url = trimmed.startsWith("http")
      ? new URL(trimmed)
      : new URL(trimmed, "http://local.invalid");
    return url.pathname || "/";
  } catch {
    const withoutHash = trimmed.split("#")[0] ?? trimmed;
    const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
    return withoutQuery || "/";
  }
}

/** True si le pathname correspond à la cible de navigation. */
export function pathMatchesTarget(pathname: string, href: string): boolean {
  const target = normalizePagePath(href);
  if (target === "/family") return pathname === "/family";
  return pathname === target || pathname.startsWith(`${target}/`);
}

/** True si le clic doit déclencher une navigation interne Next. */
function shouldTrackInternalNavigation(
  event: MouseEvent,
  currentPathname: string,
): string | null {
  if (event.defaultPrevented) return null;
  if (event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return null;
  }

  const target = event.target;
  if (!(target instanceof Element)) return null;

  const anchor = target.closest("a");
  if (!anchor) return null;
  if (anchor.hasAttribute("download")) return null;
  const linkTarget = anchor.getAttribute("target");
  if (linkTarget && linkTarget !== "_self") return null;

  const hrefAttr = anchor.getAttribute("href");
  if (!hrefAttr || hrefAttr.startsWith("#")) return null;
  if (
    hrefAttr.startsWith("mailto:") ||
    hrefAttr.startsWith("tel:") ||
    hrefAttr.startsWith("javascript:")
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(hrefAttr, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;

  const nextPath = url.pathname || "/";
  if (nextPath === currentPathname) return null;

  return nextPath;
}

/**
 * Provider global du voile de chargement page.
 * Survit aux changements de layout (bureau ↔ famille).
 * Couvre : premier chargement, clics liens internes, nav explicite dashboard.
 */
export function PageLoadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeClub, activeSpace } = useAuth();
  const [pending, setPending] = useState<PendingPageLoad | null>(null);
  const [bootOverlay, setBootOverlay] = useState(true);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const clearTimers = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const beginPageLoad = useCallback(
    (href: string, options?: PageLoadOptions) => {
      clearTimers();
      const awaitContent = options?.awaitContent ?? true;
      setPending({
        href: normalizePagePath(href),
        clubId: options?.clubId,
        space: options?.space,
        startedAt: Date.now(),
        awaitContent,
        contentReady: false,
      });
      safetyTimerRef.current = setTimeout(() => {
        safetyTimerRef.current = null;
        setPending(null);
      }, SAFETY_TIMEOUT_MS);
    },
    [clearTimers],
  );

  const markPageReady = useCallback(() => {
    setPending((current) => {
      if (!current || current.contentReady) return current;
      return { ...current, contentReady: true };
    });
  }, []);

  /** Voile au premier paint (landing et hard refresh). */
  useEffect(() => {
    const startedAt = Date.now();
    let cancelled = false;
    let delayTimer: ReturnType<typeof setTimeout> | null = null;

    const dismiss = () => {
      if (cancelled) return;
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      delayTimer = setTimeout(() => {
        if (!cancelled) setBootOverlay(false);
      }, remaining);
    };

    if (document.readyState === "complete") {
      dismiss();
    } else {
      window.addEventListener("load", dismiss, { once: true });
      delayTimer = setTimeout(dismiss, 3_000);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", dismiss);
      if (delayTimer) clearTimeout(delayTimer);
    };
  }, []);

  /** Intercepte les liens internes pour afficher le voile hors dashboard. */
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const nextPath = shouldTrackInternalNavigation(
        event,
        pathnameRef.current,
      );
      if (!nextPath) return;
      beginPageLoad(nextPath, { awaitContent: false });
    }

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [beginPageLoad]);

  useEffect(() => {
    if (!pending) return;

    const pathReady = pathMatchesTarget(pathname, pending.href);
    const clubReady =
      !pending.clubId ||
      (activeClub?.id === pending.clubId &&
        (pending.space == null || activeSpace === pending.space));

    if (!pathReady || !clubReady) return;

    if (!pending.contentReady) {
      if (pending.awaitContent) return;
      setPending((current) => {
        if (!current || current.contentReady) return current;
        return { ...current, contentReady: true };
      });
      return;
    }

    const elapsed = Date.now() - pending.startedAt;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    clearTimerRef.current = setTimeout(() => {
      clearTimerRef.current = null;
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
      setPending(null);
    }, remaining);

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, [pathname, activeClub?.id, activeSpace, pending]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const value = useMemo<PageLoadContextValue>(
    () => ({
      pendingHref: pending?.href ?? null,
      beginPageLoad,
      markPageReady,
    }),
    [pending?.href, beginPageLoad, markPageReady],
  );

  const showOverlay = bootOverlay || pending !== null;

  return (
    <PageLoadContext.Provider value={value}>
      {children}
      {showOverlay ? <PageLoadOverlay /> : null}
    </PageLoadContext.Provider>
  );
}

/** Accède au chargement de page global du portail. */
export function usePageLoad(): PageLoadContextValue {
  const ctx = useContext(PageLoadContext);
  if (!ctx) {
    throw new Error("usePageLoad doit être utilisé dans PageLoadProvider");
  }
  return ctx;
}

/**
 * Signale `markPageReady` quand `isReady` est vrai et que la navigation
 * en cours cible exactement `pageRoute` (évite qu’un panneau keep-alive
 * masqué coupe le voile via un préfixe de chemin trop large).
 */
export function useReportPageReady(
  isReady: boolean,
  pageRoute: string | null,
): void {
  const { pendingHref, markPageReady } = usePageLoad();

  useEffect(() => {
    if (!isReady || !pageRoute || !pendingHref) return;
    if (normalizePagePath(pendingHref) !== normalizePagePath(pageRoute)) {
      return;
    }
    markPageReady();
  }, [isReady, pageRoute, pendingHref, markPageReady]);
}
