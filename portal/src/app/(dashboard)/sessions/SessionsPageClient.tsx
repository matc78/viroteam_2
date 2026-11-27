"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import { LibraryPanel } from "@/components/training/LibraryPanel";
import { SessionEditor } from "@/components/training/SessionEditor";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { useAuth } from "@/lib/firebase/AuthProvider";
import type { ClubEventView } from "@/lib/firebase/eventService";
import { loadCoachTrainings } from "@/lib/firebase/trainingService";
import styles from "./page.module.css";

/** Fenêtre chargée : 6 mois passés (bibliothèque) et 8 semaines à venir. */
const PAST_DAYS = 183;
const UPCOMING_DAYS = 56;

function formatChipDay(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatChipTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Page Séances (coachs) : prochains entraînements de mes équipes en bandeau,
 * préparation de la séance choisie dessous (`?event=`). Les séances passées
 * ne sont plus listées : elles se consultent et se réutilisent depuis la
 * bibliothèque.
 */
function SessionsPageContent() {
  const { activeClub, user, profile } = useAuth();
  const caps = useBureauCapabilities();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const eventParam = searchParams.get("event");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const coachTeamIds = useMemo(
    () => new Set(caps.access.coachTeamIds),
    [caps.access.coachTeamIds],
  );
  const coachTeamKey = [...coachTeamIds].sort().join(",");

  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    activeClub,
    async (club) => {
      // Instant de référence figé au chargement (rendu pur).
      const now = Date.now();
      const events = await loadCoachTrainings({
        clubId: club.id,
        coachTeamIds,
        start: new Date(now - PAST_DAYS * 86_400_000),
        end: new Date(now + UPCOMING_DAYS * 86_400_000),
      });
      return { events, now };
    },
    [coachTeamKey],
    "/sessions",
  );

  const { all, upcoming, past } = useMemo(() => {
    const events: ClubEventView[] = data?.events ?? [];
    const now = data?.now ?? 0;
    return {
      all: events,
      // Séance en cours comprise : on la prépare jusqu’à sa fin.
      upcoming: events.filter((event) => Date.parse(event.endsAt) >= now),
      past: events.filter((event) => Date.parse(event.endsAt) < now),
    };
  }, [data]);

  const requested = eventParam
    ? (all.find((event) => event.id === eventParam) ?? null)
    : null;
  // Lien vers une séance hors de la période chargée : on le dit plutôt que
  // d’ouvrir une autre séance à préparer à sa place.
  const requestedMissing = Boolean(eventParam && data && !requested);
  const selected = eventParam ? requested : (upcoming[0] ?? null);
  const selectedIsPast = selected !== null && past.includes(selected);

  const coachName =
    profile?.displayName.trim() ||
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    "Coach";

  function selectEvent(eventId: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (eventId) next.set("event", eventId);
    else next.delete("event");
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="planning" />;
  }

  return (
    <div className={styles.page}>
      <DashboardPageIntro
        eyebrow="Coach"
        heading="Séances"
        lead="Prépare tes entraînements sur grand écran : exercices, minutage et schémas, synchronisés avec l’app."
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {coachTeamIds.size === 0 ? (
        <EmptyState title="Aucune équipe entraînée" variant="block">
          La préparation de séance est réservée aux coachs d’une équipe.
        </EmptyState>
      ) : (
        <>
          <div className={styles.strip}>
            {upcoming.length > 0 ? (
              <nav className={styles.list} aria-label="Prochains entraînements">
                <ul>
                  {upcoming.map((event, index) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        className={styles.session}
                        aria-current={selected?.id === event.id ? "true" : undefined}
                        onClick={() => selectEvent(event.id)}
                      >
                        <span className={styles.sessionDay}>
                          {index === 0 ? "Prochaine · " : ""}
                          {formatChipDay(event.startsAt)} ·{" "}
                          {formatChipTime(event.startsAt)}
                        </span>
                        <span className={styles.sessionTeams}>
                          {event.teamLabels.join(", ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : (
              <p className={styles.stripEmpty}>
                Aucun entraînement à venir : crée-les dans le planning pour
                les préparer ici.
              </p>
            )}
            {requestedMissing ? (
              <p className={styles.stripEmpty} role="status">
                Cette séance n’est pas dans la période affichée (6 mois passés,
                8 semaines à venir). Ouvre une séance ci-dessus.
              </p>
            ) : null}
            {/* Sans séance ouverte, la bibliothèque reste accessible ici. */}
            {!selected ? (
              <Button size="sm" onClick={() => setLibraryOpen(true)}>
                Bibliothèque
              </Button>
            ) : null}
          </div>

          {selected && user ? (
            <SessionEditor
              key={selected.id}
              clubId={activeClub!.id}
              event={selected}
              isPast={selectedIsPast}
              coachUid={user.uid}
              coachName={coachName}
              libraryEvents={past}
              onOpenSession={selectEvent}
              onBackToUpcoming={
                selectedIsPast && upcoming.length > 0
                  ? () => selectEvent(null)
                  : undefined
              }
            />
          ) : null}

          {libraryOpen && !selected ? (
            <LibraryPanel
              clubId={activeClub!.id}
              events={past}
              onClose={() => setLibraryOpen(false)}
              onOpenSession={(eventId) => {
                setLibraryOpen(false);
                selectEvent(eventId);
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/** Client Séances (Suspense pour searchParams). */
export function SessionsPageClient() {
  return (
    <Suspense fallback={<DashboardSkeleton variant="planning" />}>
      <SessionsPageContent />
    </Suspense>
  );
}
