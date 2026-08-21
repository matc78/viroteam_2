"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { MemberRoles } from "@/lib/firebase/constants";
import {
  memberRoleLabel,
  type ClubMemberRecord,
} from "@/lib/firebase/memberService";
import type { TeamRosterRole } from "@/lib/firebase/teamService";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./TeamFormDialog.module.css";
import addStyles from "./AddTeamMemberDialog.module.css";

type AddTeamMemberDialogProps = {
  role: TeamRosterRole;
  members: ClubMemberRecord[];
  /** IDs déjà sur le roster du slot (memberId + accountUid). */
  excludedIds: Set<string>;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (memberId: string) => Promise<void>;
};

/** Indique si le membre peut être proposé pour le slot roster (aligné app Flutter). */
function isEligibleForRosterRole(
  member: ClubMemberRecord,
  role: TeamRosterRole,
): boolean {
  if (member.status !== "active") return false;
  if (role === MemberRoles.coach) {
    return (
      member.role === MemberRoles.coach || member.role === MemberRoles.admin
    );
  }
  return (
    member.role === MemberRoles.player ||
    member.role === MemberRoles.coach ||
    member.role === MemberRoles.admin
  );
}

/** Indique si le membre est exclu du roster (memberId ou accountUid). */
function isExcluded(member: ClubMemberRecord, excludedIds: Set<string>): boolean {
  const matchIds = [member.memberId, member.accountUid].filter(
    Boolean,
  ) as string[];
  return matchIds.some((id) => excludedIds.has(id));
}

/** Filtre texte sur nom / e-mail. */
function matchesSearch(member: ClubMemberRecord, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    member.displayName,
    member.firstName,
    member.lastName,
    member.email ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Dialog pour ajouter un joueur ou un coach à une équipe. */
export function AddTeamMemberDialog({
  role,
  members,
  excludedIds,
  busy,
  error,
  onClose,
  onSubmit,
}: AddTeamMemberDialogProps) {
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");

  const roleLabel = role === MemberRoles.coach ? "coach" : "joueur";

  const eligible = useMemo(() => {
    return members
      .filter(
        (member) =>
          isEligibleForRosterRole(member, role) &&
          !isExcluded(member, excludedIds),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  }, [members, excludedIds, role]);

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return eligible.filter((member) => matchesSearch(member, needle));
  }, [eligible, search]);

  const playerCandidates = useMemo(
    () => candidates.filter((member) => member.role === MemberRoles.player),
    [candidates],
  );
  const staffCandidates = useMemo(
    () =>
      candidates.filter(
        (member) =>
          member.role === MemberRoles.coach ||
          member.role === MemberRoles.admin,
      ),
    [candidates],
  );

  const showPlayerSections = role === MemberRoles.player;

  function requestClose() {
    if (busy) return;
    onClose();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!memberId) return;
    await onSubmit(memberId);
  }

  function renderMemberButton(member: ClubMemberRecord) {
    const selected = memberId === member.memberId;
    return (
      <button
        key={member.memberId}
        type="button"
        className={addStyles.memberButton}
        data-selected={selected ? "true" : undefined}
        disabled={busy}
        aria-pressed={selected}
        onClick={() => setMemberId(member.memberId)}
      >
        <span className={addStyles.memberName}>
          {member.displayName || "Membre"}
        </span>
        <span className={addStyles.memberMeta}>
          {memberRoleLabel(member.role)}
          {member.email ? ` · ${member.email}` : ""}
        </span>
      </button>
    );
  }

  let listContent: ReactNode;
  if (eligible.length === 0) {
    listContent = (
      <p className={addStyles.empty}>
        Aucun {roleLabel} disponible à ajouter.
      </p>
    );
  } else if (candidates.length === 0) {
    listContent = (
      <p className={addStyles.empty}>
        Aucun résultat pour « {search.trim()} ».
      </p>
    );
  } else if (showPlayerSections) {
    listContent = (
      <div className={addStyles.sections}>
        {playerCandidates.length > 0 ? (
          <section className={addStyles.section}>
            <h3 className={addStyles.sectionLabel}>Joueurs du club</h3>
            <div className={addStyles.memberList} role="listbox">
              {playerCandidates.map(renderMemberButton)}
            </div>
          </section>
        ) : null}
        {staffCandidates.length > 0 ? (
          <section className={addStyles.section}>
            <h3 className={addStyles.sectionLabel}>Coachs et admins</h3>
            <div className={addStyles.memberList} role="listbox">
              {staffCandidates.map(renderMemberButton)}
            </div>
          </section>
        ) : null}
      </div>
    );
  } else {
    listContent = (
      <div className={addStyles.memberList} role="listbox">
        {candidates.map(renderMemberButton)}
      </div>
    );
  }

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <FadeScrollArea
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        viewportClassName={`${dialogStyles.body} ${styles.panelContent}`}
        data-tone="green"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-team-member-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Équipes</p>
            <h2 id="add-team-member-title" className={dialogStyles.title}>
              Ajouter un {roleLabel}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        <form
          className={styles.form}
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label className={dialogStyles.field}>
            <span className={dialogStyles.label}>Recherche</span>
            <input
              className={`${styles.input} ${addStyles.searchInput}`}
              type="search"
              value={search}
              onChange={(event) => {
                const next = event.target.value;
                setSearch(next);
                setMemberId((current) => {
                  if (!current) return current;
                  const needle = next.trim().toLowerCase();
                  const stillVisible = eligible.some(
                    (member) =>
                      member.memberId === current &&
                      matchesSearch(member, needle),
                  );
                  return stillVisible ? current : "";
                });
              }}
              disabled={busy || eligible.length === 0}
              placeholder="Nom, e-mail…"
              autoComplete="off"
              autoFocus
            />
          </label>

          <div className={dialogStyles.field}>
            <span className={dialogStyles.label}>Membre</span>
            <FadeScrollArea
              className={addStyles.listWrap}
              viewportClassName={addStyles.listViewport}
            >
              {listContent}
            </FadeScrollArea>
          </div>

          {error ? (
            <p className={dialogStyles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.buttonSecondary}
              onClick={requestClose}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={dialogStyles.button}
              disabled={busy || !memberId}
            >
              {busy ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </form>
      </FadeScrollArea>
    </div>
  );
}
