"use client";

import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AuthPageIntro } from "@/components/auth/AuthPageIntro";
import { JoinCodeEntryForm } from "@/components/auth/JoinCodeEntryForm";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import {
  AUTH_VIEW_PARAM,
  AUTH_VIEWS,
  neighbourAuthView,
  parseAuthView,
  withAuthView,
  type AuthView,
} from "@/lib/auth/authViews";
import { isFounderSignupIntent } from "@/lib/auth/signupIntent";
import { usePostAuthRedirect } from "@/lib/auth/usePostAuthRedirect";
import { authCopy } from "@/lib/copy/authCopy";
import { joinCopy } from "@/lib/copy/joinCopy";
import { useMobileLayout } from "@/lib/ui/useMobileLayout";
import styles from "./AuthCarousel.module.css";

/**
 * Part de la hauteur d’une oreille réservée au-dessus et en dessous de la
 * scène : la boîte non transformée compte entière dans le débordement de la
 * zone principale (sinon scroll de quelques pixels).
 */
const EAR_RESERVED_HEIGHT_RATIO = 1;

/** Réduction maximale appliquée pour faire tenir le carrousel à l’écran. */
const MIN_FIT_SCALE = 0.6;

/** Respiration gardée en plus du padding de la zone principale (px). */
const FIT_BREATHING_ROOM = 8;

/** Place d’une carte autour de la carte active (bureau). */
type CardPosition = "front" | "right" | "left";

const VIEW_LABELS: Record<AuthView, string> = {
  login: authCopy.viewLoginLabel,
  code: authCopy.viewCodeLabel,
  signup: authCopy.viewSignupLabel,
};

/** Accent propre à chaque carte (repris par son bouton libellé). */
const VIEW_CARD_CLASS: Record<AuthView, string> = {
  login: styles.cardLogin,
  code: styles.cardCode,
  signup: styles.cardSignup,
};

/** Position circulaire de `view` quand `active` est devant. */
function cardPosition(view: AuthView, active: AuthView): CardPosition {
  const length = AUTH_VIEWS.length;
  const offset =
    (AUTH_VIEWS.indexOf(view) - AUTH_VIEWS.indexOf(active) + length) % length;
  if (offset === 0) return "front";
  return offset === 1 ? "right" : "left";
}

/**
 * Page d’authentification unique : connexion, code d’invitation et création
 * de compte. Bureau : carrousel 3D (une carte devant, les deux autres en
 * oreilles inclinées, boutons libellés de chaque côté), mis à l’échelle pour
 * tenir sans scroll. Téléphone : défilement horizontal avec onglets et points.
 * La vue active est reflétée dans `?vue=` sans navigation.
 */
export function AuthCarousel() {
  const searchParams = useSearchParams();
  const urlView = parseAuthView(searchParams.get(AUTH_VIEW_PARAM));
  const isFounderQuery = searchParams.get("intent") === "founder";
  const [hasStoredFounderIntent, setHasStoredFounderIntent] = useState(false);
  const isFounder = isFounderQuery || hasStoredFounderIntent;
  const isMobile = useMobileLayout();
  const fitRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  /** Hauteur naturelle (non mise à l’échelle) du carrousel. */
  const [carouselHeight, setCarouselHeight] = useState<number | null>(null);
  /** Hauteur disponible sous l’en-tête (bureau). */
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<AuthView>(urlView);
  const [syncedUrlView, setSyncedUrlView] = useState<AuthView>(urlView);
  /**
   * Tentative d’inscription en cours ou réussie : la redirect « from=signup »
   * / club-setup ne dépend plus de la carte visible (évite la race si l’utilisateur
   * change de vue pendant le loader).
   */
  const [signupAttemptActive, setSignupAttemptActive] = useState(false);
  /** Auth e-mail / Google en cours : verrouille onglets, oreilles et swipe. */
  const [authBusy, setAuthBusy] = useState(false);
  /** Sources séparées : login et signup sont toujours montés dans le carrousel. */
  const loginBusyRef = useRef(false);
  const signupBusyRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<AuthView, HTMLDivElement | null>>>({});
  /** Hauteur de chaque carte : la scène se cale sur celle de devant (bureau). */
  const [cardHeights, setCardHeights] = useState<
    Partial<Record<AuthView, number>>
  >({});
  /** Cible d’un défilement programmé : le scroll ne change pas la vue avant. */
  const scrollTargetRef = useRef<AuthView | null>(null);

  // Lien externe vers une autre vue (même page) : on suit l’URL.
  if (urlView !== syncedUrlView) {
    setSyncedUrlView(urlView);
    setActiveView(urlView);
  }

  usePostAuthRedirect({
    accessDeniedFromSignup: signupAttemptActive || activeView === "signup",
  });

  // Intent fondateur mémorisé (capturé par SignupForm depuis `?intent=`).
  useEffect(() => {
    setHasStoredFounderIntent(isFounderSignupIntent());
  }, [searchParams]);

  const handleSignupAttemptChange = useCallback((active: boolean) => {
    setSignupAttemptActive(active);
  }, []);

  const syncAuthBusy = useCallback(() => {
    setAuthBusy(loginBusyRef.current || signupBusyRef.current);
  }, []);

  const handleLoginBusyChange = useCallback(
    (busy: boolean) => {
      loginBusyRef.current = busy;
      syncAuthBusy();
    },
    [syncAuthBusy],
  );

  const handleSignupBusyChange = useCallback(
    (busy: boolean) => {
      signupBusyRef.current = busy;
      syncAuthBusy();
    },
    [syncAuthBusy],
  );

  const commitView = useCallback((view: AuthView) => {
    setActiveView(view);
    const search = withAuthView(window.location.search, view);
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}`,
    );
  }, []);

  const scrollToCard = useCallback(
    (view: AuthView, behavior: ScrollBehavior) => {
      const card = cardRefs.current[view];
      const track = trackRef.current;
      if (!card || !track) return;
      scrollTargetRef.current = behavior === "smooth" ? view : null;
      track.scrollTo({
        left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2,
        behavior,
      });
    },
    [],
  );

  /** Affiche `view` devant (bureau) ou la fait défiler au centre (mobile). */
  const selectView = useCallback(
    (view: AuthView) => {
      if (authBusy) return;
      commitView(view);
      if (isMobile) scrollToCard(view, "smooth");
    },
    [authBusy, commitView, isMobile, scrollToCard],
  );

  /**
   * Mesure la mise en page : hauteur de chaque carte (la scène se cale sur
   * celle de devant, les autres débordent sur le même axe), hauteur naturelle
   * du carrousel et hauteur disponible sous l’en-tête (mise à l’échelle).
   */
  const measureLayout = useCallback(() => {
    const heights: Partial<Record<AuthView, number>> = {};
    for (const view of AUTH_VIEWS) {
      const card = cardRefs.current[view];
      if (card) heights[view] = card.offsetHeight;
    }
    setCardHeights(heights);
    const carousel = carouselRef.current;
    if (carousel) setCarouselHeight(carousel.offsetHeight);
    const main = fitRef.current?.parentElement;
    if (main) {
      const mainTop = main.getBoundingClientRect().top + window.scrollY;
      const mainStyle = window.getComputedStyle(main);
      const verticalPadding =
        parseFloat(mainStyle.paddingTop) + parseFloat(mainStyle.paddingBottom);
      setAvailableHeight(
        window.innerHeight - mainTop - verticalPadding - FIT_BREATHING_ROOM,
      );
    }
  }, []);

  /**
   * Observateur unique, créé à la demande : chaque élément est observé dès que
   * son ref s’attache (un effet monté une seule fois ne voyait pas toujours
   * les cartes en production).
   */
  const layoutObserverRef = useRef<ResizeObserver | null>(null);
  const observeLayout = useCallback(
    (element: HTMLElement | null) => {
      if (!element || typeof ResizeObserver === "undefined") return;
      layoutObserverRef.current ??= new ResizeObserver(measureLayout);
      layoutObserverRef.current.observe(element);
    },
    [measureLayout],
  );

  useEffect(() => {
    for (const view of AUTH_VIEWS) observeLayout(cardRefs.current[view] ?? null);
    observeLayout(carouselRef.current);
    measureLayout();
    window.addEventListener("resize", measureLayout);
    return () => {
      window.removeEventListener("resize", measureLayout);
      layoutObserverRef.current?.disconnect();
      layoutObserverRef.current = null;
    };
  }, [measureLayout, observeLayout]);

  const frontHeight = cardHeights[activeView] ?? null;
  const isMeasured = frontHeight !== null;
  /** Animations activées une image après la première mesure (pas de glissé au chargement). */
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (!isMeasured || isAnimated) return;
    const frame = requestAnimationFrame(() => setIsAnimated(true));
    return () => cancelAnimationFrame(frame);
  }, [isMeasured, isAnimated]);
  // Débordement vertical des oreilles plus hautes que la carte de devant :
  // réservé en marge pour ne pas recouvrir l’en-tête ni la navigation.
  const earOverflow =
    frontHeight === null
      ? 0
      : Math.max(
          0,
          ...AUTH_VIEWS.filter((view) => view !== activeView).map(
            (view) =>
              ((cardHeights[view] ?? 0) * EAR_RESERVED_HEIGHT_RATIO - frontHeight) / 2,
          ),
        );

  // Passage en mobile : la carte active est centrée sans animation.
  useEffect(() => {
    if (isMobile) scrollToCard(activeView, "instant");
    // Seulement au changement de mise en page, pas à chaque vue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  function handleTrackScroll() {
    const track = trackRef.current;
    if (!isMobile || !track || authBusy) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let nearest: AuthView = activeView;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const view of AUTH_VIEWS) {
      const card = cardRefs.current[view];
      if (!card) continue;
      const distance = Math.abs(
        card.offsetLeft + card.offsetWidth / 2 - center,
      );
      if (distance < nearestDistance) {
        nearest = view;
        nearestDistance = distance;
      }
    }
    if (scrollTargetRef.current) {
      if (nearest === scrollTargetRef.current) scrollTargetRef.current = null;
      return;
    }
    if (nearest !== activeView) commitView(nearest);
  }

  // Bureau : réduit le carrousel pour qu’il tienne sans scroll. L’échelle se
  // fonde sur la carte la plus haute pour rester stable d’une vue à l’autre.
  const tallestCard = Math.max(0, ...Object.values(cardHeights));
  const fitScale =
    isMobile || availableHeight === null || tallestCard === 0
      ? 1
      : Math.min(1, Math.max(MIN_FIT_SCALE, availableHeight / tallestCard));
  const fitStyle: CSSProperties | undefined =
    fitScale < 1 && carouselHeight !== null
      ? { height: carouselHeight * fitScale }
      : undefined;

  const leftView = neighbourAuthView(activeView, -1);
  const rightView = neighbourAuthView(activeView, 1);

  const cardContent: Record<AuthView, ReactNode> = {
    code: (
      <>
        <AuthPageIntro
          headingLevel={2}
          eyebrow={joinCopy.enterCodeEyebrow}
          title={joinCopy.enterCodeTitle}
          lead={joinCopy.enterCodeLead}
        />
        <JoinCodeEntryForm />
      </>
    ),
    login: (
      <>
        <AuthPageIntro
          headingLevel={2}
          eyebrow={authCopy.authEyebrow}
          title={authCopy.loginTitle}
          lead={authCopy.loginLead}
        />
        <LoginForm onBusyChange={handleLoginBusyChange} />
      </>
    ),
    signup: (
      <>
        <AuthPageIntro
          headingLevel={2}
          dense
          eyebrow={authCopy.authEyebrow}
          title={authCopy.signupTitle}
          lead={isFounder ? authCopy.signupFounderLead : authCopy.signupLead}
        />
        <SignupForm
          onSignupAttemptChange={handleSignupAttemptChange}
          onBusyChange={handleSignupBusyChange}
        />
      </>
    ),
  };

  return (
    <div ref={fitRef} className={styles.fit} style={fitStyle}>
      <div
        ref={(element) => {
          carouselRef.current = element;
          observeLayout(element);
        }}
        className={styles.carousel}
        style={fitScale < 1 ? { transform: `scale(${fitScale})` } : undefined}
      >
        <h1 className="sr-only">{authCopy.authPageTitle}</h1>

        <div
          className={styles.tabs}
          role="tablist"
          aria-label={authCopy.viewSwitcherLabel}
        >
          {AUTH_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              role="tab"
              id={`auth-tab-${view}`}
              aria-selected={view === activeView}
              aria-controls={`auth-card-${view}`}
              className={`${styles.tab}${view === activeView ? ` ${styles.tabActive}` : ""}`}
              disabled={authBusy}
              onClick={() => selectView(view)}
            >
              {VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.navButton} ${VIEW_CARD_CLASS[leftView]}`}
            disabled={authBusy}
            onClick={() => selectView(leftView)}
          >
            <span className={styles.navIcon} aria-hidden="true">
              <ViewIcon view={leftView} />
            </span>
            <span className={styles.navLabel}>{VIEW_LABELS[leftView]}</span>
          </button>

          <div
            ref={trackRef}
            className={styles.stage}
            data-measured={isMeasured ? "" : undefined}
            data-animated={isAnimated ? "" : undefined}
            style={
              frontHeight === null
                ? undefined
                : ({
                    "--stage-h": `${frontHeight}px`,
                    "--stage-overflow": `${Math.round(earOverflow)}px`,
                  } as CSSProperties)
            }
            onScroll={handleTrackScroll}
          >
            {AUTH_VIEWS.map((view) => {
              const position = cardPosition(view, activeView);
              const isFront = position === "front";
              return (
                <div
                  key={view}
                  ref={(element) => {
                    cardRefs.current[view] = element;
                    observeLayout(element);
                  }}
                  id={`auth-card-${view}`}
                  role="tabpanel"
                  aria-labelledby={`auth-tab-${view}`}
                  className={`${styles.card} ${VIEW_CARD_CLASS[view]}`}
                  data-position={position}
                >
                  <div className={styles.cardBody} inert={!isFront}>
                    {cardContent[view]}
                  </div>
                  {isFront ? null : (
                    // Cible souris / tactile ; au clavier, la navigation
                    // passe par les boutons libellés de part et d’autre.
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className={styles.ear}
                      disabled={authBusy}
                      onClick={() => selectView(view)}
                    >
                      <span className={styles.earIcon}>
                        <ViewIcon view={view} />
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className={`${styles.navButton} ${VIEW_CARD_CLASS[rightView]}`}
            disabled={authBusy}
            onClick={() => selectView(rightView)}
          >
            <span className={styles.navIcon} aria-hidden="true">
              <ViewIcon view={rightView} />
            </span>
            <span className={styles.navLabel}>{VIEW_LABELS[rightView]}</span>
          </button>
        </div>

        <div className={styles.dots} aria-hidden="true">
          {AUTH_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              tabIndex={-1}
              className={`${styles.dot}${view === activeView ? ` ${styles.dotActive}` : ""}`}
              disabled={authBusy}
              onClick={() => selectView(view)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Icône (Phosphor) de chaque carte, affichée dans son oreille. */
function ViewIcon({ view }: { view: AuthView }) {
  const paths: Record<AuthView, string> = {
    login:
      "M141.66,133.66l-40,40a8,8,0,0,1-11.32-11.32L116.69,136H24a8,8,0,0,1,0-16h92.69L90.34,93.66a8,8,0,0,1,11.32-11.32l40,40A8,8,0,0,1,141.66,133.66ZM200,32H136a8,8,0,0,0,0,16h56V208H136a8,8,0,0,0,0,16h64a8,8,0,0,0,8-8V40A8,8,0,0,0,200,32Z",
    code: "M227.19,104.48A16,16,0,0,0,240,88.81V64a16,16,0,0,0-16-16H32A16,16,0,0,0,16,64V88.81a16,16,0,0,0,12.81,15.67,24,24,0,0,1,0,47A16,16,0,0,0,16,167.19V192a16,16,0,0,0,16,16H224a16,16,0,0,0,16-16V167.19a16,16,0,0,0-12.81-15.67,24,24,0,0,1,0-47ZM32,167.2a40,40,0,0,0,0-78.39V64H88V192H32Zm192,0V192H104V64H224V88.8a40,40,0,0,0,0,78.39Z",
    signup:
      "M256,136a8,8,0,0,1-8,8H232v16a8,8,0,0,1-16,0V144H200a8,8,0,0,1,0-16h16V112a8,8,0,0,1,16,0v16h16A8,8,0,0,1,256,136Zm-57.87,58.85a8,8,0,0,1-12.26,10.3C165.75,181.19,138.09,168,108,168s-57.75,13.19-77.87,37.15a8,8,0,0,1-12.25-10.3c14.94-17.78,33.52-30.41,54.17-37.17a68,68,0,1,1,71.9,0C164.6,164.44,183.18,177.07,198.13,194.85ZM108,152a52,52,0,1,0-52-52A52.06,52.06,0,0,0,108,152Z",
  };
  return (
    <svg viewBox="0 0 256 256" fill="currentColor">
      <path d={paths[view]} />
    </svg>
  );
}
