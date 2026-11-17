"use client";

import { useMemo } from "react";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  loadCoachHomeDashboard,
  loadHomeDashboard,
  loadPlayerHomeDashboard,
} from "@/lib/firebase/homeService";
import {
  isClubResourceReady,
  useAsyncClubResource,
} from "@/lib/dashboard/useAsyncClubResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import { AdminHomeView } from "./AdminHomeView";
import { CoachHomeView } from "./CoachHomeView";
import { PlayerHomeView } from "./PlayerHomeView";

/**
 * Accueil composé depuis les capacités : vue club si le compte voit tout le
 * club (droit membres, équipes, planning) ou les cotisations ; sinon vue de
 * ses équipes s’il en entraîne ; sinon vue joueur. Les blocs cotisations et
 * journal suivent `viewFees` / `viewActivity`.
 */
export function HomePageClient() {
  const { activeClub, profile, user } = useAuth();
  const caps = useBureauCapabilities();
  const displayName = profile?.displayName || "Membre";
  const showClubHome = caps.seesWholeClub || caps.canViewFees;
  const showTeamsHome = !showClubHome && caps.isTeamCoach;
  const showPlayerHome = !showClubHome && !showTeamsHome;
  const homeActive = useIsPortalRouteActive(["/home"]);

  const clubResource = useAsyncClubResource(
    showClubHome ? activeClub : null,
    (club) =>
      loadHomeDashboard({
        club,
        adminDisplayName: displayName,
        uid: user?.uid,
        includeFees: caps.canViewFees,
      }),
    [displayName, showClubHome, caps.canViewFees, user?.uid],
  );

  const coachResource = useAsyncClubResource(
    showTeamsHome && user ? activeClub : null,
    (club) =>
      loadCoachHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, showTeamsHome, user?.uid],
  );

  const playerResource = useAsyncClubResource(
    showPlayerHome && user ? activeClub : null,
    (club) =>
      loadPlayerHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, showPlayerHome, user?.uid],
  );

  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homeAdmin,
    listenActiveMemberFees: true,
    onReload: clubResource.reload,
    enabled: homeActive && showClubHome,
  });
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homeCoach,
    onReload: coachResource.reload,
    enabled: homeActive && showTeamsHome,
  });
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homePlayer,
    listenActiveMemberFees: true,
    memberFeeIds: playerResource.data?.linkedMemberId
      ? [playerResource.data.linkedMemberId]
      : [],
    onReload: playerResource.reload,
    enabled: homeActive && showPlayerHome,
  });

  const active = useMemo(() => {
    if (showTeamsHome) return coachResource;
    if (showPlayerHome) return playerResource;
    return clubResource;
  }, [showTeamsHome, showPlayerHome, clubResource, coachResource, playerResource]);

  useReportPageReady(isClubResourceReady(activeClub, active), "/home");

  if (active.loading && !active.data) {
    return <DashboardSkeleton variant="home" />;
  }

  if (showTeamsHome) {
    return (
      <CoachHomeView
        clubId={activeClub?.id ?? ""}
        data={coachResource.data}
        refreshing={coachResource.refreshing}
        error={coachResource.error}
        reload={coachResource.reload}
        showActivity={caps.canViewActivity}
      />
    );
  }

  if (showPlayerHome) {
    return (
      <PlayerHomeView
        clubId={activeClub?.id ?? ""}
        data={playerResource.data}
        refreshing={playerResource.refreshing}
        error={playerResource.error}
        reload={playerResource.reload}
      />
    );
  }

  return (
    <AdminHomeView
      clubId={activeClub?.id ?? ""}
      data={clubResource.data}
      refreshing={clubResource.refreshing}
      error={clubResource.error}
      reload={clubResource.reload}
      showFees={caps.canViewFees}
      showActivity={caps.canViewActivity}
    />
  );
}
