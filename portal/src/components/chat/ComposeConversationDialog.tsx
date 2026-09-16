"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@/lib/chat/ChatProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createCoachDm } from "@/lib/firebase/chatService";
import { MemberRoles } from "@/lib/firebase/constants";
import { loadTeamsForClub } from "@/lib/firebase/eventService";
import {
  listClubMembers,
  memberRoleLabel,
} from "@/lib/firebase/memberService";
import { rosterContains, viewerMatchIds } from "@/lib/teams/viewerTeamScope";
import styles from "./ComposeConversationDialog.module.css";

type TargetOption = {
  uid: string;
  label: string;
  role: string;
};

/**
 * Dialog nouvelle discussion : sélection club + coaches/admins autorisés,
 * puis callable `createCoachDm`.
 */
export function ComposeConversationDialog() {
  const { user, bureauClubs, familyClubs, profile } = useAuth();
  const { closeCompose, openThread } = useChat();
  const clubs = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const club of [...bureauClubs, ...familyClubs]) {
      map.set(club.id, { id: club.id, name: club.name });
    }
    return [...map.values()];
  }, [bureauClubs, familyClubs]);

  const [clubId, setClubId] = useState(clubs[0]?.id ?? "");
  const [targets, setTargets] = useState<TargetOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId && clubs[0]) setClubId(clubs[0].id);
  }, [clubs, clubId]);

  useEffect(() => {
    if (!clubId || !user) return;
    let cancelled = false;
    setLoading(true);
    setSelected(new Set());
    setError(null);

    void (async () => {
      try {
        const [members, teams] = await Promise.all([
          listClubMembers(clubId),
          loadTeamsForClub(clubId),
        ]);
        if (cancelled) return;

        const club = [...bureauClubs, ...familyClubs].find(
          (item) => item.id === clubId,
        );
        const adminIds = new Set<string>(club?.adminIds ?? []);
        const rosterToAccountUid = new Map<string, string>();

        for (const member of members) {
          const accountUid = member.accountUid?.trim();
          if (!accountUid) continue;
          rosterToAccountUid.set(member.memberId, accountUid);
          rosterToAccountUid.set(accountUid, accountUid);
          if (member.role === MemberRoles.admin) adminIds.add(accountUid);
        }

        const myMember = members.find(
          (member) => member.accountUid === user.uid,
        );
        const myMatchIds = viewerMatchIds({
          uid: user.uid,
          memberId: myMember?.memberId,
          accountUid: myMember?.accountUid,
        });
        // Parents : équipes des enfants via parentTeamIds
        const parentTeamIds = new Set(
          (profile?.parentTeamIds ?? []).filter(Boolean),
        );
        const myTeams = teams.filter(
          (team) =>
            rosterContains(team.playerIds, myMatchIds) ||
            rosterContains(team.coachIds, myMatchIds) ||
            parentTeamIds.has(team.id),
        );

        const allowedUids = new Set<string>(adminIds);
        for (const team of myTeams) {
          for (const coachRosterId of team.coachIds) {
            const accountUid = rosterToAccountUid.get(coachRosterId);
            if (accountUid) allowedUids.add(accountUid);
            else if (coachRosterId) allowedUids.add(coachRosterId);
          }
        }
        allowedUids.delete(user.uid);

        const options: TargetOption[] = [];
        const seen = new Set<string>();
        for (const member of members) {
          if (
            member.role !== MemberRoles.admin &&
            member.role !== MemberRoles.coach
          ) {
            continue;
          }
          const accountUid = member.accountUid?.trim();
          if (
            !accountUid ||
            accountUid === user.uid ||
            !allowedUids.has(accountUid) ||
            seen.has(accountUid)
          ) {
            continue;
          }
          seen.add(accountUid);
          options.push({
            uid: accountUid,
            label: member.displayName.trim() || accountUid,
            role: member.role,
          });
        }
        for (const adminUid of adminIds) {
          if (adminUid === user.uid || seen.has(adminUid)) continue;
          seen.add(adminUid);
          options.push({
            uid: adminUid,
            label: adminUid,
            role: MemberRoles.admin,
          });
        }

        setTargets(options);
      } catch {
        if (!cancelled) setError("Impossible de charger les contacts.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clubId, user, bureauClubs, familyClubs, profile]);

  function toggleUid(uid: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleStart() {
    if (!clubId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const conversationId = await createCoachDm({
        clubId,
        targetUids: [...selected],
      });
      closeCompose();
      openThread({ clubId, conversationId });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de démarrer la discussion.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Messagerie</p>
            <h3 className={styles.title}>Nouvelle discussion</h3>
            <p className={styles.hint}>
              Tu peux écrire à tes coaches ou à un admin du club.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Fermer"
            onClick={closeCompose}
          >
            ×
          </button>
        </header>

        <label className={styles.label}>
          Club
          <select
            className={styles.select}
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>

        <p className={styles.sectionTitle}>Choisir qui contacter</p>
        <div className={styles.list}>
          {loading ? (
            <p className={styles.empty}>Chargement…</p>
          ) : targets.length === 0 ? (
            <p className={styles.empty}>Aucun coach ou admin disponible.</p>
          ) : (
            targets.map((target) => (
              <label key={target.uid} className={styles.row}>
                <input
                  type="checkbox"
                  checked={selected.has(target.uid)}
                  onChange={() => toggleUid(target.uid)}
                />
                <span>
                  <strong>{target.label}</strong>
                  <span className={styles.role}>
                    {memberRoleLabel(target.role)}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondary}
            onClick={closeCompose}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || selected.size === 0}
            onClick={() => void handleStart()}
          >
            Démarrer
          </button>
        </div>
      </div>
    </div>
  );
}
