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

/** Le voile n’apparaît que si le changement de club dure plus que ce délai. */
const OVERLAY_DELAY_MS = 300;

/** Filet de sécurité si une page ne signale jamais ready. */
const SAFETY_TIMEOUT_MS = 8_000;

type PageLoadOptions = {
  clubId?: string;
  space?: PortalSpace;
};

type PendingPageLoad = {
  href: string;
  clubId?: string;
  space?: PortalSpace;
  /**
   * Changement de club / espace : voile (retardé) jusqu’à `markPageReady`.
   * Sinon navigation entre modules : aucun voile, le panneau affiche son skeleton
   * et la barre d’onglets montre la progression jusqu’à `markPageReady`.
   */
  blocking: boolean;
  /** True une fois que la page cible a fini son chargement de données. */
  contentReady: boolean;
};

type PageLoadContextValue = {
  /** Cible de navigation en cours (styles nav pending). */
  pendingHref: string | null;
  /** Club ciblé par un changement de club en cours (pastille du header). */
  pendingClubId: string | null;
  /** Espace ciblé par un changement de club / espace en cours. */
  pendingSpace: PortalSpace | null;
  /** Démarre une navigation ; voile plein écran seulement si club / espace change. */
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

/**
 * Provider global du voile de chargement page.
 * Survit aux changements de layout (bureau ↔ famille).
 * Seuls les changements de club / espace masquent l’écran (après 300 ms) ;
 * la navigation entre modules s’affiche immédiatement (skeleton ou données)
 * et reste « pending » jusqu’au signal ready (barre de chargement des onglets).
 */
export function PageLoadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeClub, activeSpace } = useAuth();
  const [pending, setPending] = useState<PendingPageLoad | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const beginPageLoad = useCallback(
    (href: string, options?: PageLoadOptions) => {
      clearTimers();
      setPending({
        href: normalizePagePath(href),
        clubId: options?.clubId,
        space: options?.space,
        blocking: Boolean(options?.clubId || options?.space),
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

  /** Voile retardé : rien ne s’affiche si le changement de club est rapide. */
  const blockingPending = pending?.blocking === true;
  useEffect(() => {
    if (!blockingPending) {
      setOverlayVisible(false);
      return;
    }
    const timer = setTimeout(() => setOverlayVisible(true), OVERLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [blockingPending]);

  useEffect(() => {
    if (!pending) return;

    const pathReady = pathMatchesTarget(pathname, pending.href);
    const clubReady =
      !pending.clubId ||
      (activeClub?.id === pending.clubId &&
        (pending.space == null || activeSpace === pending.space));

    if (!pathReady || !clubReady) return;

    if (!pending.contentReady) return;

    clearTimers();
    setPending(null);
  }, [pathname, activeClub?.id, activeSpace, pending, clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const value = useMemo<PageLoadContextValue>(
    () => ({
      pendingHref: pending?.href ?? null,
      pendingClubId: pending?.clubId ?? null,
      pendingSpace: pending?.space ?? null,
      beginPageLoad,
      markPageReady,
    }),
    [
      pending?.href,
      pending?.clubId,
      pending?.space,
      beginPageLoad,
      markPageReady,
    ],
  );

  const showOverlay = overlayVisible && pending?.blocking === true;

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
