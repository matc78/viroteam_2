"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { NavLoadBar } from "@/components/common/NavLoadBar";
import { Icon } from "@/components/ui/icons";
import type { DisplayBadge } from "@/lib/auth/permissions";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { badgeLabel } from "@/lib/copy/badgeCopy";
import type { ClubMembershipTile, PortalSpace } from "@/lib/firebase/types";
import { sportEmoji } from "@/lib/sports/sportEmoji";
import styles from "./ClubSwitcher.module.css";

/** Props du sélecteur de club de la sidebar. */
type ClubSwitcherProps = {
  clubs: ClubMembershipTile[];
  /** Club sélectionné ; `null` sur les pages multi-clubs (Mon planning…). */
  activeClubId: string | null;
  activeSpace: PortalSpace;
  /** Sous-titre custom (ex. enfant suivi en espace famille). */
  formatSecondaryLabel?: (club: ClubMembershipTile) => string | null;
  onClubChange: (clubId: string, space: PortalSpace) => void;
  pendingClubId?: string | null;
  pendingSpace?: PortalSpace | null;
  /** Sidebar repliée : seul le logo du club est visible. */
  collapsed?: boolean;
};

/**
 * Badge affiché sous le nom du club (dérivé des droits et des équipes de la
 * fiche, jamais d'un rôle) ; `null` tant que les droits chargent.
 */
function clubBadge(club: ClubMembershipTile): DisplayBadge | null {
  if (club.space === "family") return "parent";
  return club.badge;
}

/** Libellé du badge sous le nom du club (vide pendant le chargement). */
function roleLabel(club: ClubMembershipTile): string {
  const badge = clubBadge(club);
  return badge ? badgeLabel(badge) : "";
}

/** Clé de couleur du badge (tokens `--color-role-*`), `member` par défaut. */
function roleTone(club: ClubMembershipTile): DisplayBadge {
  return clubBadge(club) ?? "member";
}

/** Pastille logo / emoji sport du club, teintée à sa couleur de marque. */
function ClubMark({ club }: { club: ClubMembershipTile }) {
  const brand = splitBrandColorHex(
    club.brandColorHex ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  const logoUrl = club.logoUrl?.trim() || null;
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt="" className={styles.mark} />;
  }
  return (
    <span
      className={styles.markEmoji}
      style={
        {
          "--club-brand": brand,
          "--club-brand-text": readableTextOnBrand(brand),
        } as CSSProperties
      }
      aria-hidden
    >
      {sportEmoji(club.sport)}
    </span>
  );
}

/**
 * Menu déroulant des clubs (et espaces) de l’utilisateur, en tête de sidebar.
 * Le bouton montre le club actif ; le menu liste tous les clubs + « Créer un club ».
 */
export function ClubSwitcher({
  clubs,
  activeClubId,
  activeSpace,
  formatSecondaryLabel,
  onClubChange,
  pendingClubId = null,
  pendingSpace = null,
  collapsed = false,
}: ClubSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const active =
    clubs.find(
      (club) => club.id === activeClubId && club.space === activeSpace,
    ) ?? null;
  const isPending = pendingClubId != null;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const secondary = active
    ? (formatSecondaryLabel?.(active) ?? roleLabel(active))
    : `${clubs.length} club${clubs.length > 1 ? "s" : ""}`;

  return (
    <div className={styles.root} ref={rootRef} data-collapsed={collapsed}>
      <button
        type="button"
        className={styles.trigger}
        title={collapsed && active ? active.name : undefined}
        aria-label={
          collapsed
            ? `Club : ${active?.name.trim() || "aucun"}, changer de club`
            : undefined
        }
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <NavLoadBar active={isPending} />
        {active ? (
          <ClubMark club={active} />
        ) : (
          <span className={styles.markEmpty} aria-hidden>
            <Icon name="team" size={18} />
          </span>
        )}
        <span className={styles.meta}>
          <span className={styles.name}>
            {active ? active.name.trim() || "Club" : "Tous mes clubs"}
          </span>
          <span
            className={styles.secondary}
            data-role={active ? roleTone(active) : undefined}
          >
            {secondary}
          </span>
        </span>
        <Icon name="chevronDown" size={16} className={styles.chevron} />
      </button>

      {open ? (
        <div className={styles.menu} id={menuId}>
          <p className={styles.menuLabel}>Mes clubs</p>
          <ul className={styles.list}>
            {clubs.map((club) => {
              const selected =
                club.id === activeClubId && club.space === activeSpace;
              const loading =
                club.id === pendingClubId && club.space === pendingSpace;
              return (
                <li key={`${club.space}-${club.id}`}>
                  <button
                    type="button"
                    className={styles.item}
                    aria-current={selected ? "true" : undefined}
                    aria-busy={loading || undefined}
                    onClick={() => {
                      setOpen(false);
                      if (!selected) onClubChange(club.id, club.space);
                    }}
                  >
                    <ClubMark club={club} />
                    <span className={styles.meta}>
                      <span className={styles.name}>
                        {club.name.trim() || "Club"}
                      </span>
                      <span
                        className={styles.secondary}
                        data-role={roleTone(club)}
                      >
                        {formatSecondaryLabel?.(club) ?? roleLabel(club)}
                      </span>
                    </span>
                    {selected ? (
                      <Icon name="check" size={16} className={styles.check} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/club-setup"
            className={styles.create}
            onClick={() => setOpen(false)}
          >
            <span className={styles.createIcon} aria-hidden>
              <Icon name="plus" size={16} />
            </span>
            <span className={styles.createLabel}>Créer un club</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Props de la liste de clubs affichée en clair (pages multi-clubs). */
type ClubListProps = {
  clubs: ClubMembershipTile[];
  onClubChange: (clubId: string, space: PortalSpace) => void;
  pendingClubId?: string | null;
  pendingSpace?: PortalSpace | null;
  collapsed?: boolean;
};

/**
 * Liste de tous les clubs, sans menu : sur Mon planning, Messagerie ou
 * Mon compte, aucun club n’est sélectionné, on les montre directement.
 */
export function ClubList({
  clubs,
  onClubChange,
  pendingClubId = null,
  pendingSpace = null,
  collapsed = false,
}: ClubListProps) {
  return (
    <div className={styles.inlineRoot} data-collapsed={collapsed}>
      <p className={styles.menuLabel}>Mes clubs</p>
      <ul className={styles.list}>
        {clubs.map((club) => {
          const loading =
            club.id === pendingClubId && club.space === pendingSpace;
          const name = club.name.trim() || "Club";
          return (
            <li key={`${club.space}-${club.id}`}>
              <button
                type="button"
                className={styles.item}
                aria-busy={loading || undefined}
                title={collapsed ? `${name} · ${roleLabel(club)}` : undefined}
                aria-label={collapsed ? `${name}, ${roleLabel(club)}` : undefined}
                onClick={() => onClubChange(club.id, club.space)}
              >
                <ClubMark club={club} />
                <span className={styles.meta}>
                  <span className={styles.name}>{name}</span>
                  <span
                    className={styles.secondary}
                    data-role={roleTone(club)}
                  >
                    {roleLabel(club)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Link
        href="/club-setup"
        className={styles.create}
        title={collapsed ? "Créer un club" : undefined}
        aria-label={collapsed ? "Créer un club" : undefined}
      >
        <span className={styles.createIcon} aria-hidden>
          <Icon name="plus" size={16} />
        </span>
        <span className={styles.createLabel}>Créer un club</span>
      </Link>
    </div>
  );
}
