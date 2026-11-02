"use client";

import { useMemo } from "react";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
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

/** Contenu home dashboard branché sur Firestore, adapté au rôle club. */
export function HomePageClient() {
  const { activeClub, activeClubRole, profile, user } = useAuth();
  const displayName = profile?.displayName || "Membre";
  const role = activeClubRole ?? MemberRoles.admin;
  const homeActive = useIsPortalRouteActive(["/home"]);

  const adminResource = useAsyncClubResource(
    role === MemberRoles.admin ? activeClub : null,
    (club) =>
      loadHomeDashboard({
        club,
        adminDisplayName: displayName,
        uid: user?.uid,
      }),
    [displayName, role, user?.uid],
  );

  const coachResource = useAsyncClubResource(
    role === MemberRoles.coach && user ? activeClub : null,
    (club) =>
      loadCoachHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, role, user?.uid],
  );

  const playerResource = useAsyncClubResource(
    role === MemberRoles.player && user ? activeClub : null,
    (club) =>
      loadPlayerHomeDashboard({
        club,
        displayName,
        uid: user!.uid,
      }),
    [displayName, role, user?.uid],
  );

  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homeAdmin,
    listenActiveMemberFees: true,
    onReload: adminResource.reload,
    enabled: homeActive && role === MemberRoles.admin,
  });
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homeCoach,
    onReload: coachResource.reload,
    enabled: homeActive && role === MemberRoles.coach,
  });
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.homePlayer,
    listenActiveMemberFees: true,
    memberFeeIds: playerResource.data?.linkedMemberId
      ? [playerResource.data.linkedMemberId]
      : [],
    onReload: playerResource.reload,
    enabled: homeActive && role === MemberRoles.player,
  });

  const active = useMemo(() => {
    if (role === MemberRoles.coach) return coachResource;
    if (role === MemberRoles.player) return playerResource;
    return adminResource;
  }, [role, adminResource, coachResource, playerResource]);

  useReportPageReady(isClubResourceReady(activeClub, active), "/home");

  if (active.loading && !active.data) {
    return <DashboardSkeleton variant="home" />;
  }

  if (role === MemberRoles.coach) {
    return (
      <CoachHomeView
        clubId={activeClub?.id ?? ""}
        viewerUid={user?.uid ?? null}
        data={coachResource.data}
        refreshing={coachResource.refreshing}
        error={coachResource.error}
        reload={coachResource.reload}
      />
    );
  }

  if (role === MemberRoles.player) {
    return (
      <PlayerHomeView
        clubId={activeClub?.id ?? ""}
        viewerUid={user?.uid ?? null}
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
      viewerUid={user?.uid ?? null}
      data={adminResource.data}
      refreshing={adminResource.refreshing}
      error={adminResource.error}
      reload={adminResource.reload}
    />
  );
}
