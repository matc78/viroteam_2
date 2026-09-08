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
};

type PendingPageLoad = {
  href: string;
  clubId?: string;
  space?: PortalSpace;
  startedAt: number;
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

/** True si le pathname correspond à la cible de navigation. */
export function pathMatchesTarget(pathname: string, href: string): boolean {
  if (href === "/family") return pathname === "/family";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Provider global du voile de chargement page.
 * Survit aux changements de layout (bureau ↔ famille).
 * Ne se retire qu’après `markPageReady` (+ route/club alignés).
 */
export function PageLoadProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { activeClub, activeSpace } = useAuth();
  const [pending, setPending] = useState<PendingPageLoad | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setPending({
        href,
        clubId: options?.clubId,
        space: options?.space,
        startedAt: Date.now(),
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

  useEffect(() => {
    if (!pending) return;

    const pathReady = pathMatchesTarget(pathname, pending.href);
    const clubReady =
      !pending.clubId ||
      (activeClub?.id === pending.clubId &&
        (pending.space == null || activeSpace === pending.space));

    if (!pathReady || !clubReady || !pending.contentReady) return;

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

  return (
    <PageLoadContext.Provider value={value}>
      {children}
      {pending ? <PageLoadOverlay /> : null}
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
    if (pendingHref !== pageRoute) return;
    markPageReady();
  }, [isReady, pageRoute, pendingHref, markPageReady]);
}
