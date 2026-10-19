"use client";

import { useEffect, useState } from "react";
import {
  createOrRefreshTeamInvite,
  revokeTeamInvite,
  type TeamInviteResult,
} from "@/lib/firebase/callableService";
import { joinCopy } from "@/lib/copy/joinCopy";
import { site } from "@/lib/site";
import styles from "./InviteTeamDialog.module.css";

type InviteTeamDialogProps = {
  clubId: string;
  clubName: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
};

/**
 * Dialog coach : code d’équipe multi-usage (partage / régénérer / révoquer).
 */
export function InviteTeamDialog({
  clubId,
  clubName,
  teamId,
  teamName,
  onClose,
}: InviteTeamDialogProps) {
  const [invite, setInvite] = useState<TeamInviteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load(forceRefresh = false) {
    setLoading(true);
    setError(null);
    try {
      const result = await createOrRefreshTeamInvite({
        clubId,
        teamId,
        forceRefresh,
      });
      setInvite(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : joinCopy.teamInviteCreateFailed,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once per team
  }, [clubId, teamId]);

  async function copyCode() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setNotice(joinCopy.teamCodeCopied);
  }

  async function shareMessage() {
    if (!invite) return;
    const message = joinCopy.teamInviteShareMessage({
      clubName,
      teamName: invite.teamName || teamName,
      code: invite.code,
      joinUrl: invite.joinUrl,
      appStoreUrl: site.appStoreUrl,
      playStoreUrl: site.playStoreUrl,
      siteUrl: site.url,
    });
    await navigator.clipboard.writeText(message);
    setNotice(joinCopy.teamLinkCopied);
  }

  async function regenerate() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!invite || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await revokeTeamInvite({
        clubId: invite.clubId,
        invitationId: invite.invitationId,
      });
      setNotice(joinCopy.teamCodeRevoked);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : joinCopy.teamInviteRevokeFailed,
      );
    } finally {
      setBusy(false);
    }
  }

  const expiresLabel = invite
    ? new Date(invite.expiresAt).toLocaleDateString("fr-FR")
    : "";

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-labelledby="invite-team-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="invite-team-title" className={styles.title}>
          {joinCopy.inviteTeamTitle}
        </h2>
        <p className={styles.subtitle}>{joinCopy.inviteTeamSubtitle}</p>

        {loading ? (
          <p className={styles.hint}>{joinCopy.loadingTeamCode}</p>
        ) : error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : invite ? (
          <>
            <p className={styles.code}>{invite.code}</p>
            <p className={styles.meta}>
              {joinCopy.teamInviteUses(invite.useCount, invite.maxUses)}
            </p>
            <p className={styles.meta}>
              {joinCopy.teamInviteExpires(expiresLabel)}
            </p>
            {notice ? <p className={styles.notice}>{notice}</p> : null}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => void shareMessage()}
              >
                {joinCopy.shareTeamCode}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={busy}
                onClick={() => void copyCode()}
              >
                {joinCopy.copyTeamCode}
              </button>
              <button
                type="button"
                className={styles.ghost}
                disabled={busy}
                onClick={() => void regenerate()}
              >
                {joinCopy.regenerateTeamCode}
              </button>
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() => void revoke()}
              >
                {joinCopy.revokeTeamCode}
              </button>
            </div>
          </>
        ) : null}

        <button type="button" className={styles.close} onClick={onClose}>
          {joinCopy.close}
        </button>
      </div>
    </div>
  );
}
