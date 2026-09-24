"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ClubAudienceScopePicker } from "@/components/chat/ClubAudienceScopePicker";
import { useChat } from "@/lib/chat/ChatProvider";
import type { ChannelAudienceScope } from "@/lib/chat/channelAudienceScope";
import {
  readableTextOnBrand,
  splitBrandColorHex,
} from "@/lib/clubSetup/clubBrandColors";
import { ClubSetupDefaults } from "@/lib/clubSetup/constants";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createCategoryChannel } from "@/lib/firebase/chatService";
import { MemberRoles } from "@/lib/firebase/constants";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  loadTeamsForClub,
  type TeamOption,
} from "@/lib/firebase/eventService";
import { sortTeamCategories } from "@/lib/teams/compareTeamCategories";
import styles from "./CreateCategoryChannelDialog.module.css";

const EMPTY_SCOPE: ChannelAudienceScope = {
  scopeType: "categories",
  scopeIds: [],
};

function clubBrandStyle(club: ClubRecord): CSSProperties {
  const brand = splitBrandColorHex(
    club.brandColorHex ?? ClubSetupDefaults.brandColorHex,
  ).primary;
  return {
    "--club-brand": brand,
    background: brand,
    color: readableTextOnBrand(brand),
  } as CSSProperties;
}

/**
 * Dialog admin : crée un canal ciblé (callable `createCategoryChannel`).
 * Le canal « tout le club » est déjà sync — pas proposé ici.
 */
export function CreateCategoryChannelDialog() {
  const { user, bureauClubs } = useAuth();
  const { closeCategoryChannel, openThread, roleForClub } = useChat();

  const adminClubs = useMemo(
    () =>
      bureauClubs.filter(
        (club) => roleForClub(club.id) === MemberRoles.admin,
      ),
    [bureauClubs, roleForClub],
  );

  const [clubId, setClubId] = useState(adminClubs[0]?.id ?? "");
  const [scope, setScope] = useState<ChannelAudienceScope>(EMPTY_SCOPE);
  const [title, setTitle] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedClub = useMemo(
    () => adminClubs.find((club) => club.id === clubId) ?? adminClubs[0],
    [adminClubs, clubId],
  );

  const categories = useMemo(
    () =>
      sortTeamCategories(
        teams
          .map((team) => team.category.trim())
          .filter((category) => category.length > 0),
        selectedClub?.sport,
      ),
    [teams, selectedClub?.sport],
  );

  useEffect(() => {
    if (!clubId && adminClubs[0]) setClubId(adminClubs[0].id);
  }, [adminClubs, clubId]);

  useEffect(() => {
    if (!clubId) return;
    let cancelled = false;
    setLoadingTeams(true);
    setScope(EMPTY_SCOPE);
    setTitle("");
    setError(null);
    void loadTeamsForClub(clubId)
      .then((loaded) => {
        if (cancelled) return;
        setTeams(loaded);
      })
      .catch((loadError) => {
        console.error("[chat] loadTeamsForClub failed", loadError);
        if (!cancelled) {
          setTeams([]);
          setError("Impossible de charger les équipes.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTeams(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId]);

  const selectedClubBrand = useMemo(() => {
    if (!selectedClub) return null;
    const primary = splitBrandColorHex(
      selectedClub.brandColorHex ?? ClubSetupDefaults.brandColorHex,
    ).primary;
    return {
      primary,
      text: readableTextOnBrand(primary),
    };
  }, [selectedClub]);

  const suggestedTitle = useMemo(() => {
    if (scope.scopeIds.length === 0) return "";
    if (scope.scopeType === "categories") {
      return sortTeamCategories(scope.scopeIds, selectedClub?.sport).join(" · ");
    }
    const names = scope.scopeIds
      .map((id) => teams.find((team) => team.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    if (scope.scopeType === "parents") {
      return names.length > 0 ? `Parents · ${names.join(" · ")}` : "";
    }
    return names.join(" · ");
  }, [scope, teams, selectedClub?.sport]);

  async function handleSubmit() {
    if (!clubId || scope.scopeIds.length === 0 || !user) return;
    setBusy(true);
    setError(null);
    try {
      const conversationId = await createCategoryChannel({
        clubId,
        scopeType: scope.scopeType,
        scopeIds: scope.scopeIds,
        title: title.trim() || suggestedTitle,
      });
      closeCategoryChannel();
      openThread({ clubId, conversationId });
    } catch (submitError) {
      console.error("[chat] createCategoryChannel failed", submitError);
      setError("Création du canal impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (adminClubs.length === 0) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={closeCategoryChannel}
      role="presentation"
    >
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Créer canal"
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Créer canal</h2>
            <p className={styles.hint}>
              Canal en lecture seule (seuls les admins écrivent). Le canal
              « tout le club » existe déjà.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Fermer"
            onClick={closeCategoryChannel}
          >
            ×
          </button>
        </div>

        <div className={styles.field}>
          {adminClubs.length === 1 && selectedClub ? (
            <div className={styles.singleClubWrap}>
              <span
                className={styles.singleClub}
                style={clubBrandStyle(selectedClub)}
              >
                {selectedClub.name}
              </span>
            </div>
          ) : (
            <div
              className={styles.clubChips}
              role="radiogroup"
              aria-label="Club"
            >
              {adminClubs.map((club) => {
                const selected = club.id === clubId;
                return (
                  <button
                    key={club.id}
                    type="button"
                    role="radio"
                    className={styles.clubChip}
                    style={clubBrandStyle(club)}
                    aria-checked={selected}
                    data-selected={selected ? "true" : "false"}
                    disabled={busy}
                    onClick={() => setClubId(club.id)}
                  >
                    {club.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label id="channel-scope-label">Destinataires</label>
          {loadingTeams ? (
            <p className={styles.hint}>Chargement des équipes…</p>
          ) : (
            <ClubAudienceScopePicker
              teams={teams}
              categories={categories}
              value={scope}
              disabled={busy}
              accentColor={selectedClubBrand?.primary}
              accentTextColor={selectedClubBrand?.text}
              onChange={setScope}
            />
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor="channel-title">Titre affiché</label>
          <input
            id="channel-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={suggestedTitle || "Ex. Parents U15"}
            disabled={busy}
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={closeCategoryChannel}
            disabled={busy}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={busy || scope.scopeIds.length === 0 || loadingTeams}
            onClick={() => void handleSubmit()}
          >
            {busy ? "Création…" : "Créer le canal"}
          </button>
        </div>
      </div>
    </div>
  );
}
