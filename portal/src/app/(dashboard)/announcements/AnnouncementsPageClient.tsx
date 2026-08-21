"use client";

import { useMemo, useState } from "react";
import { CreateAnnouncementDialog } from "@/components/dashboard/CreateAnnouncementDialog";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import {
  announcementTargetLabel,
  clearAnnouncementEndsAt,
  closeAnnouncement,
  createAnnouncement,
  loadClubAnnouncements,
  mapGuestsToAnnouncementTarget,
  partitionAnnouncements,
  type ClubAnnouncementRecord,
} from "@/lib/firebase/announcementService";
import { AnnouncementTargetTypes } from "@/lib/firebase/constants";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { ClubRecord } from "@/lib/firebase/clubService";
import {
  loadPlanningPeopleForClub,
  loadTeamsForClub,
  type PlanningPersonOption,
  type TeamOption,
} from "@/lib/firebase/eventService";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import tabStyles from "@/components/dashboard/MembersTabs.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./page.module.css";

type AnnouncementsTab = "active" | "finished";

type AnnouncementsPageData = {
  announcements: ClubAnnouncementRecord[];
  teams: TeamOption[];
  people: PlanningPersonOption[];
  categories: string[];
};

/** Charge annonces + données de ciblage pour la page bureau. */
async function loadAnnouncementsPageData(
  club: ClubRecord,
): Promise<AnnouncementsPageData> {
  const [announcements, teams, people] = await Promise.all([
    loadClubAnnouncements(club.id),
    loadTeamsForClub(club.id),
    loadPlanningPeopleForClub(club.id),
  ]);
  const categories = Array.from(
    new Set(
      teams
        .map((team) => team.category.trim())
        .filter((category) => category.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b, "fr"));
  return { announcements, teams, people, categories };
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Contenu page Annonces branché sur Firestore. */
export function AnnouncementsPageClient() {
  const { activeClub, user, profile } = useAuth();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadAnnouncementsPageData,
    [],
  );
  const [tab, setTab] = useState<AnnouncementsTab>("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const teamNamesById = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of data?.teams ?? []) {
      map.set(team.id, team.name);
    }
    return map;
  }, [data?.teams]);

  const { active, finished } = useMemo(
    () => partitionAnnouncements(data?.announcements ?? []),
    [data?.announcements],
  );

  const visibleList = tab === "active" ? active : finished;

  async function handleCreate(values: {
    message: string;
    allClub: boolean;
    guests: Parameters<typeof mapGuestsToAnnouncementTarget>[0]["guests"];
    endsAt: Date;
  }) {
    if (!activeClub || !user || !data) return;
    setCreateBusy(true);
    setCreateError(null);
    try {
      const audience = mapGuestsToAnnouncementTarget({
        allClub: values.allClub,
        guests: values.guests,
        teams: data.teams,
        people: data.people,
      });
      if (
        audience.targetType !== AnnouncementTargetTypes.allMembers &&
        audience.targetIds.length === 0
      ) {
        throw new Error("Sélectionnez au moins un destinataire.");
      }
      await createAnnouncement({
        clubId: activeClub.id,
        senderId: user.uid,
        senderFirstName: profile?.firstName?.trim() || "Admin",
        senderLastName: profile?.lastName?.trim() || "",
        message: values.message,
        targetType: audience.targetType,
        targetIds: audience.targetIds,
        endsAt: values.endsAt,
      });
      setCreateOpen(false);
      reload();
    } catch (createFailure) {
      setCreateError(
        createFailure instanceof Error
          ? createFailure.message
          : "Impossible de publier l’annonce.",
      );
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleClose(announcementId: string) {
    if (!activeClub || !user) return;
    setBusyId(announcementId);
    setActionError(null);
    try {
      await closeAnnouncement({
        clubId: activeClub.id,
        announcementId,
        closedBy: user.uid,
      });
      reload();
    } catch (closeFailure) {
      setActionError(
        closeFailure instanceof Error
          ? closeFailure.message
          : "Impossible de clôturer l’annonce.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleClearEndsAt(announcementId: string) {
    if (!activeClub) return;
    setBusyId(announcementId);
    setActionError(null);
    try {
      await clearAnnouncementEndsAt({
        clubId: activeClub.id,
        announcementId,
      });
      reload();
    } catch (clearFailure) {
      setActionError(
        clearFailure instanceof Error
          ? clearFailure.message
          : "Impossible de retirer la date limite.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="home" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Annonces"
        lead={`Publiez des messages ciblés pour ${activeClub?.name ?? "votre club"} et suivez ceux en cours ou terminés.`}
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <div className={styles.toolbar}>
            <div className={tabStyles.tabs} role="tablist" aria-label="Annonces">
              <button
                type="button"
                role="tab"
                id="announcements-tab-active"
                aria-selected={tab === "active"}
                aria-controls="announcements-panel-active"
                className={`${tabStyles.tab} ${tab === "active" ? tabStyles.tabActive : ""}`}
                onClick={() => setTab("active")}
              >
                En cours ({active.length})
              </button>
              <button
                type="button"
                role="tab"
                id="announcements-tab-finished"
                aria-selected={tab === "finished"}
                aria-controls="announcements-panel-finished"
                className={`${tabStyles.tab} ${tab === "finished" ? tabStyles.tabActive : ""}`}
                onClick={() => setTab("finished")}
              >
                Terminées ({finished.length})
              </button>
            </div>
            <button
              type="button"
              className={styles.createButton}
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              Nouvelle annonce
            </button>
          </div>

          {actionError ? (
            <p className={styles.errorInline} role="alert">
              {actionError}
            </p>
          ) : null}

          <div
            id={
              tab === "active"
                ? "announcements-panel-active"
                : "announcements-panel-finished"
            }
            role="tabpanel"
            aria-labelledby={
              tab === "active"
                ? "announcements-tab-active"
                : "announcements-tab-finished"
            }
            className={styles.list}
          >
            {visibleList.length === 0 ? (
              <p className={styles.empty}>
                {tab === "active"
                  ? "Aucune annonce en cours."
                  : "Aucune annonce terminée."}
              </p>
            ) : (
              visibleList.map((announcement) => {
                const authorName =
                  `${announcement.senderFirstName} ${announcement.senderLastName}`.trim() ||
                  "Admin";
                const isBusy = busyId === announcement.id;
                return (
                  <article key={announcement.id} className={styles.card}>
                    <div className={styles.meta}>
                      <span className={styles.badge}>
                        {announcementTargetLabel(announcement, teamNamesById)}
                      </span>
                      <span>Par {authorName}</span>
                      <span>Publiée {formatDateTime(announcement.createdAt)}</span>
                      {announcement.endsAt ? (
                        <span>
                          Date limite {formatDateTime(announcement.endsAt)}
                        </span>
                      ) : (
                        <span>Sans date limite</span>
                      )}
                      {announcement.closedAt ? (
                        <span>
                          Clôturée {formatDateTime(announcement.closedAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className={styles.message}>{announcement.message}</p>
                    {tab === "active" ? (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.actionButton}
                          disabled={isBusy}
                          onClick={() => void handleClose(announcement.id)}
                        >
                          {isBusy ? "…" : "Clôturer"}
                        </button>
                        {announcement.endsAt ? (
                          <button
                            type="button"
                            className={styles.actionButtonSecondary}
                            disabled={isBusy}
                            onClick={() =>
                              void handleClearEndsAt(announcement.id)
                            }
                          >
                            Retirer la date limite
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </>
      ) : null}

      {createOpen && data ? (
        <CreateAnnouncementDialog
          teams={data.teams}
          categories={data.categories}
          people={data.people}
          busy={createBusy}
          error={createError}
          onClose={() => {
            if (!createBusy) setCreateOpen(false);
          }}
          onSubmit={handleCreate}
        />
      ) : null}
    </div>
  );
}
