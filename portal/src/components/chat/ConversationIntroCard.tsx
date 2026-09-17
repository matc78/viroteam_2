"use client";

import { useMemo, type CSSProperties } from "react";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import type { ConversationParticipant } from "@/lib/chat/conversationParticipants";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { MemberRoles, PortalUiRoles } from "@/lib/firebase/constants";
import styles from "./ConversationIntroCard.module.css";

type ConversationIntroCardProps = {
  title: string;
  clubName?: string;
  clubColor?: string | null;
  participants: ConversationParticipant[];
  onOpenInfo?: () => void;
};

type RoleCount = {
  role: string;
  count: number;
  label: string;
};

/** Pluriel FR pour les stats de rôles dans l’intro de discussion. */
function roleCountLabel(role: string, count: number): string {
  if (role === MemberRoles.admin) {
    return count <= 1 ? "1 admin" : `${count} admins`;
  }
  if (role === MemberRoles.coach) {
    return count <= 1 ? "1 coach" : `${count} coachs`;
  }
  if (role === MemberRoles.player) {
    return count <= 1 ? "1 joueur" : `${count} joueurs`;
  }
  if (role === PortalUiRoles.parent) {
    return count <= 1 ? "1 parent" : `${count} parents`;
  }
  return `${count}`;
}

/**
 * Agrège les participants par rôle (ordre admin → coach → joueur → parent).
 */
export function countParticipantsByRole(
  participants: ConversationParticipant[],
): RoleCount[] {
  const counts = new Map<string, number>();
  for (const participant of participants) {
    const role = participant.role || MemberRoles.player;
    counts.set(role, (counts.get(role) ?? 0) + 1);
  }

  const order = [
    MemberRoles.admin,
    MemberRoles.coach,
    MemberRoles.player,
    PortalUiRoles.parent,
  ];

  const rows: RoleCount[] = [];
  for (const role of order) {
    const count = counts.get(role) ?? 0;
    if (count <= 0) continue;
    rows.push({ role, count, label: roleCountLabel(role, count) });
  }

  for (const [role, count] of counts) {
    if (order.includes(role as (typeof order)[number])) continue;
    if (count <= 0) continue;
    rows.push({ role, count, label: roleCountLabel(role, count) });
  }

  return rows;
}

/**
 * Encadré d’intro en tête du scroll messages (style carte WhatsApp) :
 * nom du groupe, club, effectif, stats de rôles.
 */
export function ConversationIntroCard({
  title,
  clubName,
  clubColor,
  participants,
  onOpenInfo,
}: ConversationIntroCardProps) {
  const brand = splitBrandColorHex(
    clubColor ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  const brandText = readableTextOnBrand(brand);
  const memberCount = participants.length;
  const roleStats = useMemo(
    () => countParticipantsByRole(participants),
    [participants],
  );
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";

  const content = (
    <>
      <span
        className={styles.avatar}
        style={
          {
            background: `color-mix(in srgb, ${brand} 28%, white)`,
            color: brand,
          } as CSSProperties
        }
        aria-hidden
      >
        {initial}
      </span>
      <h3 className={styles.title}>{title}</h3>
      {clubName ? (
        <span
          className={styles.clubChip}
          style={
            {
              "--club-brand": brand,
              "--club-brand-text": brandText,
            } as CSSProperties
          }
        >
          {clubName}
        </span>
      ) : null}
      <p className={styles.meta}>
        {memberCount} membre{memberCount > 1 ? "s" : ""}
      </p>
      {roleStats.length > 0 ? (
        <ul className={styles.roleStats} aria-label="Répartition des rôles">
          {roleStats.map((stat) => (
            <li key={stat.role}>
              <RoleBadge role={stat.role} size="sm" label={stat.label} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  if (onOpenInfo) {
    return (
      <button
        type="button"
        className={`${styles.card} ${styles.cardButton}`}
        onClick={onOpenInfo}
        aria-label="Ouvrir les infos du groupe"
      >
        {content}
      </button>
    );
  }

  return <div className={styles.card}>{content}</div>;
}
