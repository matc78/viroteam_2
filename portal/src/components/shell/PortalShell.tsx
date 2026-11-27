"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { NavLoadBar } from "@/components/common/NavLoadBar";
import { usePageLoad } from "@/components/common/PageLoadProvider";
import { ClubList, ClubSwitcher } from "@/components/shell/ClubSwitcher";
import { Icon, type IconName } from "@/components/ui/icons";
import { useChatOptional } from "@/lib/chat/ChatProvider";
import { requestPersonalPlanningReload } from "@/lib/dashboard/personalPlanningReload";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { shouldShowPersonalPlanningTile } from "@/lib/firebase/personalPlanningService";
import type { ClubMembershipTile, PortalSpace } from "@/lib/firebase/types";
import { site } from "@/lib/site";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./PortalShell.module.css";

/** Ton de la pastille d’icône d’un lien (tokens `--tone-*` de globals.css). */
export type PortalNavTone =
  | "blue"
  | "violet"
  | "cyan"
  | "green"
  | "orange"
  | "amber"
  | "pink"
  | "teal"
  | "slate";

/** Entrée de navigation d’un module du club. */
export type PortalNavItem = {
  href: string;
  label: string;
  icon: IconName;
  tone: PortalNavTone;
};

/** Props de la coquille commune bureau / famille. */
type PortalShellProps = {
  /** Libellé accessible de l’espace (« espace club », « espace famille »). */
  spaceLabel: string;
  homeHref: string;
  navItems: readonly PortalNavItem[];
  isNavItemActive: (pathname: string, href: string) => boolean;
  /** Page multi-clubs (Mon planning, Messagerie, Mon compte) : aucun club sélectionné. */
  crossClub: boolean;
  myPlanningHref: string;
  /** Lien « Mes classements » (multi-clubs), `null` = masqué (aucun club de volley). */
  standingsHref?: string | null;
  accountHref: string;
  /** Lien « Régler » du bandeau d’échéance de cotisation. */
  feesHref: string;
  feeDeadlineUrgent: boolean;
  /** Planning / messagerie : le contenu gère son propre scroll. */
  fillViewport: boolean;
  /** Pages larges (planning, membres) : pas de largeur max de lecture. */
  wide: boolean;
  clubs: ClubMembershipTile[];
  activeClubId: string | null;
  activeSpace: PortalSpace;
  formatClubSecondaryLabel?: (club: ClubMembershipTile) => string | null;
  onClubChange: (clubId: string, space: PortalSpace) => void;
  /** Sous-titre du bloc compte (rôle ou enfant suivi). */
  accountSubtitle: string;
  /** Garde de route de l’espace (rendue avant le contenu). */
  routeGuard: ReactNode;
  children: ReactNode;
};

function userInitials(displayName: string): string {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  if (nameParts.length === 0) return "?";
  if (nameParts.length === 1) return nameParts[0]!.slice(0, 1).toUpperCase();
  return `${nameParts[0]!.slice(0, 1)}${nameParts[1]!.slice(0, 1)}`.toUpperCase();
}

/** Clé de préférence locale : sidebar repliée (confort, par navigateur). */
const COLLAPSED_STORAGE_KEY = "viro.sidebarCollapsed";

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function isPathUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Lien de la sidebar avec barre de chargement et état actif. */
function SidebarLink({
  href,
  label,
  icon,
  tone,
  active,
  pending,
  badge,
  ariaLabel,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: IconName;
  tone: PortalNavTone;
  active: boolean;
  pending: boolean;
  badge?: number;
  ariaLabel?: string;
  /** Sidebar repliée : libellé masqué visuellement, affiché en infobulle. */
  collapsed: boolean;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      prefetch
      className={styles.navLink}
      data-tone={tone}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <NavLoadBar active={pending && !active} />
      <span className={styles.navIcon} aria-hidden>
        <Icon name={icon} size={17} />
      </span>
      <span className={styles.navLabel}>{label}</span>
      {badge != null && badge > 0 ? (
        <span className={styles.navBadge} aria-hidden>
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Coquille de l’espace connecté : sidebar (club, modules, liens perso, compte)
 * sur desktop, top bar + tiroir sous 960px. Le contenu défile à droite.
 */
export function PortalShell({
  spaceLabel,
  homeHref,
  navItems,
  isNavItemActive,
  crossClub,
  myPlanningHref,
  standingsHref = null,
  accountHref,
  feesHref,
  feeDeadlineUrgent,
  fillViewport,
  wide,
  clubs,
  activeClubId,
  activeSpace,
  formatClubSecondaryLabel,
  onClubChange,
  accountSubtitle,
  routeGuard,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const chat = useChatOptional();
  const { pendingHref, pendingClubId, pendingSpace, beginPageLoad } =
    usePageLoad();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useDialogA11y({
    onClose: () => setDrawerOpen(false),
    enabled: drawerOpen,
  });

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(readCollapsedPreference());
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Préférence non mémorisée (navigation privée) : sans conséquence.
      }
      return next;
    });
  }

  // Le tiroir mobile se referme à chaque navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const displayName = profile?.displayName?.trim() || "Mon compte";
  const avatarUrl = profile?.avatarUrl?.trim() || null;
  const showMyPlanning = shouldShowPersonalPlanningTile(profile);
  const showMessages = CHAT_MESSAGING_LIVE && chat != null;
  const unread = chat?.totalUnread ?? 0;
  const activeClub = clubs.find(
    (club) => club.id === activeClubId && club.space === activeSpace,
  );
  const onFeesPage = isPathUnder(pathname, feesHref);

  /** Handler de clic : lance la barre de chargement sauf si déjà sur la page. */
  function navigate(href: string, active: boolean) {
    return () => {
      if (!active) beginPageLoad(href);
    };
  }

  const sidebar = (
    <div
      ref={drawerRef}
      className={styles.sidebar}
      data-open={drawerOpen}
      role={drawerOpen ? "dialog" : undefined}
      aria-modal={drawerOpen || undefined}
      aria-label={drawerOpen ? "Navigation" : undefined}
    >
      <div className={styles.sidebarTop}>
        <Link
          href={homeHref}
          className={styles.brand}
          aria-label={`${site.name} — ${spaceLabel}`}
          onClick={navigate(homeHref, pathname === homeHref)}
        >
          <BrandMark className={styles.brandMark} priority />
          <span className={styles.wordmark}>{site.name}</span>
        </Link>
        <button
          type="button"
          className={styles.collapseToggle}
          aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
          title={collapsed ? "Déplier le menu" : "Replier le menu"}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
        >
          <Icon
            name={collapsed ? "sidebarExpand" : "sidebarCollapse"}
            size={20}
          />
        </button>
        <button
          type="button"
          className={styles.drawerClose}
          aria-label="Fermer le menu"
          onClick={() => setDrawerOpen(false)}
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {crossClub ? (
        <nav className={styles.nav} aria-label="Mes clubs">
          <ClubList
            clubs={clubs}
            onClubChange={onClubChange}
            pendingClubId={pendingClubId}
            pendingSpace={pendingSpace}
            collapsed={collapsed}
          />
        </nav>
      ) : (
        <>
          <ClubSwitcher
            clubs={clubs}
            activeClubId={activeClubId}
            activeSpace={activeSpace}
            formatSecondaryLabel={formatClubSecondaryLabel}
            onClubChange={onClubChange}
            pendingClubId={pendingClubId}
            pendingSpace={pendingSpace}
            collapsed={collapsed}
          />

          <nav className={styles.nav} aria-label={`Modules ${spaceLabel}`}>
            <ul className={styles.navList}>
              {navItems.map((item) => {
                const active = isNavItemActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <SidebarLink
                      href={item.href}
                      label={item.label}
                      icon={item.icon}
                      tone={item.tone}
                      active={active}
                      pending={pendingHref === item.href}
                      collapsed={collapsed}
                      onNavigate={navigate(item.href, active)}
                    />
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      <div className={styles.sidebarBottom}>
        <ul className={styles.navList}>
          {showMyPlanning ? (
            <li>
              <SidebarLink
                href={myPlanningHref}
                label="Mon planning"
                icon="calendar"
                tone="cyan"
                active={isPathUnder(pathname, myPlanningHref)}
                pending={pendingHref === myPlanningHref}
                collapsed={collapsed}
                ariaLabel={
                  isPathUnder(pathname, myPlanningHref)
                    ? "Mon planning (recliquer pour actualiser)"
                    : undefined
                }
                onNavigate={(event) => {
                  if (isPathUnder(pathname, myPlanningHref)) {
                    event.preventDefault();
                    requestPersonalPlanningReload("tile-reclick");
                    return;
                  }
                  beginPageLoad(myPlanningHref);
                }}
              />
            </li>
          ) : null}
          {standingsHref ? (
            <li>
              <SidebarLink
                href={standingsHref}
                label="Mes classements"
                icon="trophy"
                tone="amber"
                active={isPathUnder(pathname, standingsHref)}
                pending={pendingHref === standingsHref}
                collapsed={collapsed}
                onNavigate={(event) => {
                  if (isPathUnder(pathname, standingsHref)) {
                    event.preventDefault();
                    return;
                  }
                  beginPageLoad(standingsHref);
                }}
              />
            </li>
          ) : null}
          {showMessages && chat ? (
            <li>
              <SidebarLink
                href={chat.messagesHref}
                label="Messagerie"
                icon="chat"
                tone="pink"
                badge={unread}
                active={isPathUnder(pathname, chat.messagesHref)}
                pending={pendingHref === chat.messagesHref}
                collapsed={collapsed}
                ariaLabel={
                  unread > 0
                    ? `Messagerie, ${unread} non lu${unread > 1 ? "s" : ""}`
                    : undefined
                }
                onNavigate={navigate(
                  chat.messagesHref,
                  isPathUnder(pathname, chat.messagesHref),
                )}
              />
            </li>
          ) : null}
        </ul>

        <Link
          href={accountHref}
          className={styles.account}
          title={collapsed ? `${displayName} · Mon compte` : undefined}
          aria-label={collapsed ? `Mon compte (${displayName})` : undefined}
          aria-current={isPathUnder(pathname, accountHref) ? "page" : undefined}
          onClick={navigate(accountHref, isPathUnder(pathname, accountHref))}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarInitials} aria-hidden>
              {userInitials(displayName)}
            </span>
          )}
          <span className={styles.accountMeta}>
            <span className={styles.accountName}>{displayName}</span>
            <span className={styles.accountSubtitle}>
              {crossClub ? "Mon compte" : accountSubtitle}
            </span>
          </span>
          <Icon name="settings" size={17} className={styles.accountIcon} />
        </Link>
      </div>
    </div>
  );

  return (
    <div
      className={styles.layout}
      data-fill={fillViewport}
      data-collapsed={collapsed}
      data-drawer-open={drawerOpen}
    >
      {routeGuard}

      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.burger}
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Icon name="menu" size={22} />
        </button>
        <span className={styles.topbarTitle}>
          {crossClub || !activeClub ? site.name : activeClub.name}
        </span>
        <Link
          href={accountHref}
          className={styles.topbarAccount}
          aria-label="Mon compte"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarInitials} aria-hidden>
              {userInitials(displayName)}
            </span>
          )}
        </Link>
      </header>

      {drawerOpen ? (
        <div
          className={styles.backdrop}
          aria-hidden
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}

      {sidebar}

      <main className={styles.main} data-wide={wide} data-fill={fillViewport}>
        {feeDeadlineUrgent && !onFeesPage && !crossClub ? (
          <div className={styles.feeBanner} role="status">
            <span>
              <strong>Dernier jour pour la cotisation.</strong> Le règlement
              est attendu aujourd’hui.
            </span>
            <Link
              href={feesHref}
              className={styles.feeBannerLink}
              onClick={() => beginPageLoad(feesHref)}
            >
              Régler
            </Link>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
