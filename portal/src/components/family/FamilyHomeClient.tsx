"use client";

import { usePathname } from "next/navigation";
import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FamilyAudienceSwitcher } from "@/components/family/FamilyAudienceSwitcher";
import { MemberHome } from "@/components/home/MemberHome";
import { useFamilyAudience } from "@/components/family/FamilyAudienceProvider";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import {
  isClubResourceReady,
  useAsyncClubResource,
} from "@/lib/dashboard/useAsyncClubResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
} from "@/lib/dashboard/useClubRealtimeReload";
import {
  loadAnnouncementsForGuardian,
  loadAnnouncementsForMember,
  type ClubAnnouncementRecord,
} from "@/lib/firebase/announcementService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  HOME_PREVIEW_EVENT_LIMIT,
  loadTeamsByIds,
  loadTeamsForClub,
  loadUpcomingEvents,
  loadUpcomingEventsForGuardian,
  type ClubEventView,
} from "@/lib/firebase/eventService";
import {
  getActiveSeason,
  getMemberFee,
  remainingCents,
  type FeeSeasonRecord,
  type MemberFeeRecord,
} from "@/lib/firebase/feeService";
import { getClubMember } from "@/lib/firebase/memberService";
import { isExcludedFromEvent } from "@/lib/teams/viewerTeamScope";

/** Vue membre : événement le convoquant (jamais s’il en a été retiré). */
function eventForMember(event: ClubEventView, memberId: string): boolean {
  if (isExcludedFromEvent(event, memberId)) return false;
  return event.teamMemberIds.includes(memberId);
}

/**
 * Vue parent : événement convoquant l’enfant ou visant l’une de ses équipes,
 * sauf si l’enfant a été retiré des convoqués (événement invisible).
 */
function eventForChild(
  event: ClubEventView,
  childMemberId: string,
  childTeamIds: string[],
): boolean {
  if (isExcludedFromEvent(event, childMemberId)) return false;
  if (event.teamMemberIds.includes(childMemberId)) return true;
  return event.teamIds.some((teamId) => childTeamIds.includes(teamId));
}

type FamilyHomeData = {
  memberDisplayName: string;
  memberFirstName: string;
  nextEvent: ClubEventView | null;
  upcoming: ClubEventView[];
  fee: MemberFeeRecord | null;
  season: FeeSeasonRecord | null;
  remaining: number;
  announcements: Array<{
    id: string;
    author: string;
    message: string;
  }>;
};

/** Accueil famille : chips + couleur club, nom enfant mis en avant. */
export function FamilyHomeClient() {
  const pathname = usePathname();
  const { activeClub, profile } = useAuth();
  const { selectedMemberId, selectedTarget, loading: audienceLoading } =
    useFamilyAudience();

  const { data, loading, refreshing, error, reload, loadedClubId } =
    useAsyncClubResource(
    activeClub,
    async (club) => {
      if (!selectedMemberId) {
        return {
          memberDisplayName: "l’enfant",
          memberFirstName: "l’enfant",
          nextEvent: null,
          upcoming: [],
          fee: null,
          season: null,
          remaining: 0,
          announcements: [],
        } satisfies FamilyHomeData;
      }

      const isGuardianView = selectedTarget?.kind === "child";

      let filtered: ClubEventView[];
      let announcements: ClubAnnouncementRecord[];
      let member: Awaited<ReturnType<typeof getClubMember>>;
      let season: FeeSeasonRecord | null;

      // Cotisation lancée dès que la saison est connue (indépendante du reste).
      const seasonPromise = getActiveSeason(club.id);
      const feePromise = seasonPromise.then((activeSeason) =>
        activeSeason
          ? getMemberFee(club.id, activeSeason.id, selectedMemberId)
          : null,
      );
      // Évite un rejet non géré si une autre lecture échoue avant l’await.
      feePromise.catch(() => undefined);

      if (isGuardianView) {
        [member, season] = await Promise.all([
          getClubMember(club.id, selectedMemberId),
          seasonPromise,
        ]);
        const childMember = member;
        const childTeamIds = childMember?.teamIds ?? [];
        const teams = await loadTeamsByIds(club.id, childTeamIds);
        const [events, guardianAnnouncements] = await Promise.all([
          loadUpcomingEventsForGuardian(club.id, childTeamIds, {
            limit: 20,
            teams,
          }),
          childMember
            ? loadAnnouncementsForGuardian({
                clubId: club.id,
                member: childMember,
                childTeamIds,
                teamCategoryById: new Map(
                  teams.map((team) => [team.id, team.category]),
                ),
              })
            : Promise.resolve([]),
        ]);
        filtered = events.filter((event) =>
          eventForChild(event, selectedMemberId, childTeamIds),
        );
        announcements = guardianAnnouncements;
      } else {
        let events: ClubEventView[];
        let teams: Awaited<ReturnType<typeof loadTeamsForClub>>;
        [member, events, teams, season] = await Promise.all([
          getClubMember(club.id, selectedMemberId),
          loadUpcomingEvents(club.id, { limit: 20 }),
          loadTeamsForClub(club.id),
          seasonPromise,
        ]);
        filtered = events.filter((event) =>
          eventForMember(event, selectedMemberId),
        );
        const teamCategoryById = new Map(
          teams.map((team) => [team.id, team.category]),
        );
        announcements = member
          ? await loadAnnouncementsForMember({
              clubId: club.id,
              member,
              teamCategoryById,
            })
          : [];
      }

      const fee: MemberFeeRecord | null = await feePromise;
      const remaining = fee && season ? remainingCents(fee, season) : 0;

      const isSelf = selectedTarget?.kind === "self";
      const memberDisplayName = isSelf
        ? profile?.displayName ||
          [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") ||
          "toi"
        : member?.displayName ||
          selectedTarget?.displayName ||
          [member?.firstName, member?.lastName].filter(Boolean).join(" ") ||
          "l’enfant";
      const memberFirstName = isSelf
        ? profile?.firstName || "toi"
        : member?.firstName ||
          selectedTarget?.label ||
          memberDisplayName.split(" ")[0] ||
          "l’enfant";

      return {
        memberDisplayName,
        memberFirstName,
        nextEvent: filtered[0] ?? null,
        upcoming: filtered.slice(0, HOME_PREVIEW_EVENT_LIMIT),
        fee,
        season,
        remaining,
        announcements: announcements.map((item) => ({
          id: item.id,
          author: [item.senderFirstName, item.senderLastName]
            .filter(Boolean)
            .join(" "),
          message: item.message,
        })),
      } satisfies FamilyHomeData;
    },
    [
      selectedMemberId,
      selectedTarget?.label,
      selectedTarget?.displayName,
      selectedTarget?.kind,
      profile?.firstName,
      profile?.lastName,
      profile?.displayName,
    ],
  );
  const familyHomeActive = pathname === "/family";
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.familyHome,
    listenActiveMemberFees: true,
    memberFeeIds: selectedMemberId ? [selectedMemberId] : [],
    onReload: reload,
    enabled: familyHomeActive,
  });

  useReportPageReady(
    !audienceLoading &&
      isClubResourceReady(activeClub, { loading, loadedClubId }),
    "/family",
  );

  if ((loading || audienceLoading) && !data) {
    return <DashboardSkeleton variant="home" />;
  }

  const isSelf = selectedTarget?.kind === "self";
  const clubName = activeClub?.name ?? "Ton club";
  const focusName =
    data?.memberDisplayName ||
    selectedTarget?.displayName ||
    (isSelf ? "toi" : "l’enfant");
  const firstName = data?.memberFirstName ?? focusName;

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <MemberHome
        eyebrow={isSelf ? clubName : `${clubName} · Suivi parent`}
        title={isSelf ? `Bonjour ${firstName}` : focusName}
        headerExtra={<FamilyAudienceSwitcher />}
        error={error}
        events={data?.upcoming ?? []}
        planningHref="/family/planning"
        feesHref="/family/fees"
        rsvp={
          activeClub && selectedMemberId
            ? { clubId: activeClub.id, memberId: selectedMemberId }
            : null
        }
        answerPrompt={isSelf ? "Tu viens ?" : `${firstName} vient ?`}
        emptyEventsText={
          isSelf
            ? "Aucun événement à venir pour toi."
            : `Aucun événement à venir pour ${firstName}.`
        }
        fee={data?.fee ?? null}
        season={data?.season ?? null}
        remainingCents={data?.remaining ?? 0}
        childFirstName={isSelf ? null : firstName}
        announcements={(data?.announcements ?? []).map((item) => ({
          id: item.id,
          message: item.message,
          author: item.author,
        }))}
      />
    </div>
  );
}
