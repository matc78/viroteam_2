"use client";

import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import {
  clubActivityDetail,
  clubActivityTitle,
  listClubActivity,
  type ClubActivityEventRecord,
} from "@/lib/firebase/activityService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { ClubRecord } from "@/lib/firebase/clubService";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./ActivityPage.module.css";

function formatEventDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function actorLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Par un membre du staff";
  return `Par ${trimmed}`;
}

async function loadActivityPage(
  club: ClubRecord,
): Promise<ClubActivityEventRecord[]> {
  return listClubActivity(club.id, 50);
}

/**
 * Journal des dernières actions club (droit `viewActivity`).
 */
export function ActivityPageClient() {
  const { activeClub } = useAuth();
  const caps = useBureauCapabilities();
  const canAccess = caps.canViewActivity;
  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    canAccess ? activeClub : null,
    loadActivityPage,
    [],
    "/activity",
  );
  const activityActive = useIsPortalRouteActive(["/activity"]);
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.activity,
    onReload: reload,
    enabled: activityActive && canAccess,
  });

  if (!canAccess) {
    return (
      <div className={styles.page}>
        <DashboardPageIntro
          eyebrow="Espace club"
          heading="Dernières actions"
          lead="Réservé aux membres qui ont le droit de voir le journal d’activité."
        />
      </div>
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  const events = data ?? [];

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading="Dernières actions"
        lead="Ce qui s’est passé récemment dans le club."
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {!error && events.length === 0 ? (
        <p className={styles.empty}>
          Rien pour l’instant — les prochaines actions (membres, events,
          invitations…) apparaîtront ici.
        </p>
      ) : null}

      {!error && events.length > 0 ? (
        <ul className={styles.list} aria-label="Journal d’activité">
          {events.map((event) => (
            <li key={event.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.itemTitle}>
                  {clubActivityTitle(event)}
                </span>
                <time
                  className={styles.itemDate}
                  dateTime={event.createdAt?.toISOString()}
                >
                  {formatEventDate(event.createdAt)}
                </time>
              </div>
              <p className={styles.itemDetail}>
                {[
                  clubActivityDetail(event),
                  actorLabel(event.actorDisplayName),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
