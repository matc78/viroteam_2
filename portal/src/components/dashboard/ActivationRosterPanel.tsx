"use client";

import { useMemo, useState } from "react";
import { memberRoleLabel } from "@/lib/firebase/memberService";
import {
  computeActivationStats,
  filterActivationRows,
  memberHasValidPendingInvite,
  type ActivationBucket,
  type MemberRow,
} from "@/lib/members/membersView";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import styles from "./ActivationRosterPanel.module.css";

/** Props panneau Activation roster. */
type ActivationRosterPanelProps = {
  members: MemberRow[];
  busy: boolean;
  /** Peut lancer les envois d’invitation e-mail. */
  canInviteActions: boolean;
  onOpenMember: (member: MemberRow) => void;
  /** Envoie les invites pour la liste d’ids fournie. */
  onSendInvitesForIds: (memberIds: string[]) => Promise<void>;
};

const BUCKET_ORDER: ActivationBucket[] = [
  "withEmailNotLinked",
  "pendingInvite",
  "noEmail",
  "linked",
];

const BUCKET_LABELS: Record<ActivationBucket, string> = {
  withEmailNotLinked: "À inviter",
  pendingInvite: "Invite en cours",
  noEmail: "Sans e-mail",
  linked: "Comptes liés",
};

const BUCKET_HINTS: Record<ActivationBucket, string> = {
  withEmailNotLinked:
    "Pas encore inscrits, avec e-mail, sans invitation valide — prêts pour un premier envoi.",
  pendingInvite:
    "Code d’invitation encore valide — idéal pour une relance.",
  noEmail:
    "Fiches club sans e-mail. Ajoute une adresse depuis la fiche pour pouvoir inviter.",
  linked: "Déjà inscrits sur ViroTeam — rien à faire.",
};

const EMPTY_BY_BUCKET: Record<ActivationBucket, string> = {
  withEmailNotLinked: "Personne à inviter pour le moment.",
  pendingInvite: "Aucune invite en cours.",
  noEmail: "Tous les non-inscrits ont un e-mail.",
  linked: "Personne n’a encore lié son compte.",
};

/** Libellé + ton du badge statut d’activation. */
function activationStatusBadge(row: MemberRow): {
  label: string;
  tone: "ok" | "warn" | "info" | "muted";
} {
  if (row.hasLinkedAccount) return { label: "Inscrit", tone: "ok" };
  if (!row.email?.trim()) return { label: "Sans e-mail", tone: "muted" };
  if (memberHasValidPendingInvite(row)) {
    return { label: "Invite en cours", tone: "info" };
  }
  return { label: "À inviter", tone: "warn" };
}

/**
 * Onglet Activation : stats d’adoption du roster + actions bulk invite / relance.
 */
export function ActivationRosterPanel({
  members,
  busy,
  canInviteActions,
  onOpenMember,
  onSendInvitesForIds,
}: ActivationRosterPanelProps) {
  const stats = useMemo(() => computeActivationStats(members), [members]);
  const [bucket, setBucket] = useState<ActivationBucket>("withEmailNotLinked");

  const filtered = useMemo(
    () => filterActivationRows(members, bucket),
    [members, bucket],
  );

  const needsFirstInviteIds = useMemo(
    () =>
      filterActivationRows(members, "withEmailNotLinked").map(
        (row) => row.memberId,
      ),
    [members],
  );
  const pendingIds = useMemo(
    () =>
      filterActivationRows(members, "pendingInvite").map((row) => row.memberId),
    [members],
  );

  const linkedPct =
    stats.total > 0 ? Math.round((stats.linked / stats.total) * 100) : 0;

  return (
    <div className={styles.layout}>
      <div className={styles.summaryCard}>
        <p className={styles.summaryLead}>
          {stats.linked} compte{stats.linked > 1 ? "s" : ""} lié
          {stats.linked > 1 ? "s" : ""} sur {stats.total} membre
          {stats.total > 1 ? "s" : ""}
          {stats.total > 0 ? ` (${linkedPct} %)` : ""}.
        </p>
        <p className={styles.summaryHint}>
          Importe d’abord le roster (même sans e-mail), puis active les comptes
          ici quand tu en as besoin.
        </p>
        {canInviteActions ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonPrimary}
              disabled={busy || needsFirstInviteIds.length === 0}
              onClick={() => void onSendInvitesForIds(needsFirstInviteIds)}
            >
              {busy
                ? "Envoi…"
                : `Inviter (${needsFirstInviteIds.length})`}
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              disabled={busy || pendingIds.length === 0}
              onClick={() => void onSendInvitesForIds(pendingIds)}
            >
              {busy
                ? "Envoi…"
                : `Relancer les invites en cours (${pendingIds.length})`}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.chips} role="tablist" aria-label="Filtres activation">
        {BUCKET_ORDER.map((key) => {
          const count =
            key === "linked"
              ? stats.linked
              : key === "pendingInvite"
                ? stats.pendingInvite
                : key === "noEmail"
                  ? stats.noEmail
                  : stats.withEmailNotLinked;
          const selected = bucket === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${styles.chip} ${selected ? styles.chipActive : ""}`}
              onClick={() => setBucket(key)}
            >
              <span className={styles.chipValue}>{count}</span>
              <span className={styles.chipLabel}>{BUCKET_LABELS[key]}</span>
            </button>
          );
        })}
      </div>

      <p className={styles.bucketHint}>{BUCKET_HINTS[bucket]}</p>

      {filtered.length === 0 ? (
        <p className={styles.empty}>{EMPTY_BY_BUCKET[bucket]}</p>
      ) : (
        <div className={styles.tableCard}>
          <FadeScrollArea className={styles.tableScroll} axis="both">
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Nom</th>
                  <th scope="col">Rôle</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Statut</th>
                  <th scope="col">Équipes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const status = activationStatusBadge(row);
                  return (
                    <tr
                      key={row.memberId}
                      className={styles.row}
                      onClick={() => onOpenMember(row)}
                    >
                      <td>
                        <button
                          type="button"
                          className={styles.nameButton}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenMember(row);
                          }}
                        >
                          {row.displayName}
                        </button>
                      </td>
                      <td>{memberRoleLabel(row.role)}</td>
                      <td className={styles.muted}>
                        {row.email?.trim() || "—"}
                      </td>
                      <td>
                        <span className={styles.badge} data-tone={status.tone}>
                          {status.label}
                        </span>
                      </td>
                      <td className={styles.muted}>
                        {row.teamNames.length > 0
                          ? row.teamNames.join(", ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </FadeScrollArea>
        </div>
      )}
    </div>
  );
}
