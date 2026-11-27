"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { federationCopy as copy } from "@/lib/copy/federationCopy";
import {
  callableErrorMessage,
  refreshTeamFederation,
  unlinkTeamFederation,
} from "@/lib/firebase/callableService";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import { loadTeamFederationLink } from "@/lib/firebase/standingsService";
import type { TeamFederationLink } from "@/lib/standings/standingsTypes";
import { TeamFederationLinkDialog } from "./TeamFederationLinkDialog";
import styles from "./TeamDetailPanel.module.css";

/** Props de la section FFVB du panneau équipe. */
type TeamFederationSectionProps = {
  clubId: string;
  team: TeamOption;
  /** Noms / avatars des joueurs (étape convocations de la liaison). */
  membersById: ReadonlyMap<string, ClubMemberRecord>;
  /** Lier / modifier / actualiser / délier (droit équipes ou coach de l’équipe). */
  canManage: boolean;
};

type LinkState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; link: TeamFederationLink | null };

/** Message d’une erreur de callable (texte du serveur), sinon générique. */
function errorMessage(error: unknown): string {
  return callableErrorMessage(error, copy.actionFailed);
}

/**
 * Lien FFVB d’une équipe (club de volley) : poule liée, dernière synchro,
 * Lier / Modifier (dialog en deux étapes), Actualiser et Délier avec
 * confirmation sur place.
 */
export function TeamFederationSection({
  clubId,
  team,
  membersById,
  canManage,
}: TeamFederationSectionProps) {
  const teamId = team.id;
  const [state, setState] = useState<LinkState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteMatches, setDeleteMatches] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const link = await loadTeamFederationLink(clubId, teamId);
      setState({ status: "ready", link });
    } catch {
      setState({ status: "error" });
    }
  }, [clubId, teamId]);

  useEffect(() => {
    setState({ status: "loading" });
    setLinking(false);
    setConfirming(false);
    setDeleteMatches(false);
    setNotice(null);
    setError(null);
    void reload();
  }, [reload]);

  function openLinkDialog() {
    setNotice(null);
    setError(null);
    setLinking(true);
  }

  async function handleRefresh() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const report = await refreshTeamFederation({ clubId, teamId });
      setNotice(copy.refreshed(report.created + report.updated));
      await reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const result = await unlinkTeamFederation({
        clubId,
        teamId,
        deleteImportedMatches: deleteMatches,
      });
      setConfirming(false);
      setDeleteMatches(false);
      setNotice(
        deleteMatches
          ? copy.unlinkedWithMatches(result.deletedMatches)
          : copy.unlinked,
      );
      await reload();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const link = state.status === "ready" ? state.link : null;

  return (
    <section className={styles.section} aria-labelledby="team-federation">
      <div className={styles.sectionHeader}>
        <h3 id="team-federation" className={styles.sectionTitle}>
          {copy.sectionTitle}
        </h3>
        {link && canManage && !confirming ? (
          <div className={styles.federationActions}>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={openLinkDialog}
            >
              {copy.editLink}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void handleRefresh()}
            >
              {busy ? copy.refreshing : copy.refresh}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={styles.dangerTrigger}
              disabled={busy}
              onClick={() => {
                setNotice(null);
                setError(null);
                setConfirming(true);
              }}
            >
              {copy.unlink}
            </Button>
          </div>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <p className={styles.emptyText} aria-live="polite">
          {copy.loading}
        </p>
      ) : state.status === "error" ? (
        <p className={styles.error} role="alert">
          {copy.loadFailed}
        </p>
      ) : !link ? (
        <>
          <p className={styles.emptyText}>
            {copy.notLinked}
            {canManage ? ` ${copy.linkActionHint}` : ""}
          </p>
          {canManage ? (
            <div>
              <Button size="sm" variant="secondary" onClick={openLinkDialog}>
                {copy.linkAction}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={styles.federationBody}>
          {link.poolLabel ? (
            <p className={styles.federationPool}>{link.poolLabel}</p>
          ) : null}
          <p className={styles.emptyText}>{copy.teamInPool(link.teamName)}</p>
          {link.lastSyncFailed ? (
            <p className={styles.empty}>
              <StatusBadge tone="warning" dot>
                {copy.syncFailed}
              </StatusBadge>
            </p>
          ) : link.lastSyncAt ? (
            <p className={styles.emptyText}>{copy.lastSync(link.lastSyncAt)}</p>
          ) : null}
          {link.url ? (
            <a
              className={styles.federationLink}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {copy.openOnFfvb}
            </a>
          ) : null}
        </div>
      )}

      {confirming ? (
        <div className={styles.federationConfirm}>
          <p className={styles.dangerText}>
            <strong>{copy.unlinkTitle}</strong> {copy.unlinkBody}
          </p>
          <label className={styles.federationCheck}>
            <input
              type="checkbox"
              checked={deleteMatches}
              disabled={busy}
              onChange={(event) => setDeleteMatches(event.target.checked)}
            />
            <span>
              {copy.deleteImportedMatches}
              <span className={styles.federationHint}>
                {copy.deleteImportedMatchesHint}
              </span>
            </span>
          </label>
          <div className={styles.dangerActions}>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void handleUnlink()}
            >
              {copy.confirmUnlink}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {copy.cancel}
            </Button>
          </div>
        </div>
      ) : null}

      {notice ? (
        <p className={styles.federationNotice} aria-live="polite">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {/* Portail : hors du panneau latéral (contexte d’empilement à 55). */}
      {linking
        ? createPortal(
            <TeamFederationLinkDialog
              clubId={clubId}
              team={team}
              membersById={membersById}
              current={link}
              onClose={() => setLinking(false)}
              onLinked={() => void reload()}
            />,
            document.body,
          )
        : null}
    </section>
  );
}
