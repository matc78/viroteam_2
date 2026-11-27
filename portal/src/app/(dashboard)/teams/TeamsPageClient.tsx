"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { TeamsAdminView } from "@/components/dashboard/TeamsAdminView";
import type { TeamFormValues } from "@/components/dashboard/CreateTeamDialog";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useToast } from "@/components/ToastProvider";
import {
  canAddPlayerToTeam,
  canShareTeamInvite,
  membersVisibleToViewer,
  teamsVisibleToViewer,
} from "@/lib/auth/bureauPermissions";
import { useBureauCapabilities } from "@/lib/auth/useBureauCapabilities";
import { useAsyncClubPageResource } from "@/components/common/useAsyncClubPageResource";
import {
  ClubListenSets,
  useClubRealtimeReload,
  useIsPortalRouteActive,
} from "@/lib/dashboard/useClubRealtimeReload";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  addMemberToTeam,
  createTeam,
  deleteTeam,
  removeMemberFromTeam,
  setTeamPlayerSparring,
  updateTeam,
  type TeamRosterRole,
} from "@/lib/firebase/teamService";
import { loadMembersPageData } from "@/lib/members/membersView";

/** Contenu page Équipes (gestion admin / coach). */
function TeamsPageContent() {
  const { activeClub, user } = useAuth();
  const caps = useBureauCapabilities();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamQuery = searchParams.get("team");
  const { showToast } = useToast();

  const { data, loading, refreshing, error, reload } = useAsyncClubPageResource(
    activeClub,
    (club) => loadMembersPageData(club, { canListFees: false }),
    [],
    "/teams",
  );
  const teamsActive = useIsPortalRouteActive(["/teams"]);
  useClubRealtimeReload({
    clubId: activeClub?.id,
    collections: ClubListenSets.team,
    onReload: reload,
    enabled: teamsActive,
  });

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setActionError(null);
  }, [activeClub?.id]);

  const scopedTeams = useMemo(() => {
    if (!data) return [];
    return teamsVisibleToViewer({
      caps,
      uid: user?.uid ?? null,
      teams: data.teams,
    });
  }, [data, caps, user?.uid]);

  const scopedMembers = useMemo(() => {
    if (!data) return [];
    return membersVisibleToViewer({
      caps,
      uid: user?.uid ?? null,
      teams: data.teams,
      members: data.members,
    });
  }, [data, caps, user?.uid]);

  /** Lien `?team=` consommé par la vue (panneau ouvert) : nettoie l’URL. */
  const clearTeamQuery = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  /**
   * Exécute une action équipe avec busy / erreur / toast succès partagés.
   * Retourne true si l’action a réussi.
   */
  async function runTeamAction(
    action: () => Promise<void>,
    options: {
      successMessage?: string;
      errorFallback: string;
    },
  ): Promise<boolean> {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      if (options.successMessage) {
        showToast(options.successMessage, "success");
      }
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : options.errorFallback;
      setActionError(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Crée une équipe puis recharge la page. */
  async function handleCreateTeam(values: TeamFormValues) {
    if (!activeClub) return;
    const ok = await runTeamAction(
      async () => {
        await createTeam({
          clubId: activeClub.id,
          name: values.name,
          category: values.category,
        });
        reload();
      },
      {
        successMessage: "Équipe créée.",
        errorFallback: "Création de l’équipe impossible.",
      },
    );
    if (!ok) throw new Error("Création de l’équipe impossible.");
  }

  /** Met à jour le nom / la catégorie d’une équipe. */
  async function handleUpdateTeam(teamId: string, values: TeamFormValues) {
    if (!activeClub) return;
    const ok = await runTeamAction(
      async () => {
        await updateTeam({
          clubId: activeClub.id,
          teamId,
          name: values.name,
          category: values.category,
        });
        reload();
      },
      {
        successMessage: "Équipe mise à jour.",
        errorFallback: "Mise à jour de l’équipe impossible.",
      },
    );
    if (!ok) throw new Error("Mise à jour de l’équipe impossible.");
  }

  /** Supprime une équipe du club. Retourne true si la suppression a réussi. */
  async function handleDeleteTeam(teamId: string): Promise<boolean> {
    if (!activeClub) return false;
    return runTeamAction(
      async () => {
        await deleteTeam({ clubId: activeClub.id, teamId });
        reload();
      },
      {
        successMessage: "Équipe supprimée.",
        errorFallback: "Suppression de l’équipe impossible.",
      },
    );
  }

  /** Ajoute un joueur ou un coach au roster d’une équipe. */
  async function handleAddTeamMember(params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) {
    if (!activeClub) return;
    // Nommer un coach : droit équipes ; ajouter un joueur : droit équipes ou
    // coach autorisé de l’équipe.
    if (params.role === "coach" && !caps.canManageTeams) return;
    if (
      params.role === "player" &&
      !canAddPlayerToTeam(caps.access, params.teamId)
    ) {
      return;
    }
    const ok = await runTeamAction(
      async () => {
        await addMemberToTeam({
          clubId: activeClub.id,
          teamId: params.teamId,
          memberId: params.memberId,
          role: params.role,
        });
        reload();
      },
      {
        successMessage: "Changement appliqué.",
        errorFallback: "Ajout au roster impossible.",
      },
    );
    if (!ok) throw new Error("Ajout au roster impossible.");
  }

  /** Retire un joueur ou un coach du roster d’une équipe. */
  async function handleRemoveTeamMember(params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) {
    if (!activeClub) return;
    await runTeamAction(
      async () => {
        await removeMemberFromTeam({
          clubId: activeClub.id,
          teamId: params.teamId,
          memberId: params.memberId,
          role: params.role,
        });
        reload();
      },
      {
        successMessage: "Changement appliqué.",
        errorFallback: "Retrait du roster impossible.",
      },
    );
  }

  /** Passe un joueur sparring ou le repasse joueur (droit d’ajout de joueurs). */
  async function handleSetSparring(params: {
    teamId: string;
    memberId: string;
    sparring: boolean;
  }) {
    if (!activeClub) return;
    if (!canAddPlayerToTeam(caps.access, params.teamId)) return;
    await runTeamAction(
      async () => {
        await setTeamPlayerSparring({
          clubId: activeClub.id,
          teamId: params.teamId,
          memberId: params.memberId,
          sparring: params.sparring,
        });
        reload();
      },
      {
        successMessage: params.sparring
          ? "Joueur passé en sparring : il n’est plus convoqué d’office aux matchs."
          : "Joueur de retour : il est reconvoqué aux matchs à venir.",
        errorFallback: "Changement du statut sparring impossible.",
      },
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data && activeClub ? (
        <TeamsAdminView
          clubId={activeClub.id}
          clubName={activeClub.name}
          teams={scopedTeams}
          members={scopedMembers}
          sport={activeClub.sport}
          busy={busy}
          error={actionError}
          viewerMemberId={user?.uid ?? null}
          openTeamId={teamQuery}
          onOpenTeamHandled={clearTeamQuery}
          refreshing={refreshing}
          onRefresh={reload}
          canManageTeams={caps.canManageTeams}
          canAddPlayerToTeam={(team) =>
            canAddPlayerToTeam(caps.access, team.id)
          }
          canShareTeamInvite={(team) =>
            canShareTeamInvite(caps.access, team.id)
          }
          onClearError={() => setActionError(null)}
          onCreateTeam={handleCreateTeam}
          onUpdateTeam={handleUpdateTeam}
          onDeleteTeam={handleDeleteTeam}
          onAddMember={handleAddTeamMember}
          onRemoveMember={handleRemoveTeamMember}
          onSetSparring={handleSetSparring}
        />
      ) : null}
    </div>
  );
}

/** Client Équipes (Suspense pour searchParams). */
export function TeamsPageClient() {
  return (
    <Suspense fallback={<DashboardSkeleton variant="members" />}>
      <TeamsPageContent />
    </Suspense>
  );
}
