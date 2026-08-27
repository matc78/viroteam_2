"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddMemberDialog } from "@/components/dashboard/AddMemberDialog";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ImportMembersDialog } from "@/components/dashboard/ImportMembersDialog";
import { InviteParentDialog } from "@/components/dashboard/InviteParentDialog";
import { MemberDetailPanel } from "@/components/dashboard/MemberDetailPanel";
import { MembersTable } from "@/components/dashboard/MembersTable";
import { ParentsTable } from "@/components/dashboard/ParentsTable";
import { TeamsPanel } from "@/components/dashboard/TeamsPanel";
import type { TeamFormValues } from "@/components/dashboard/CreateTeamDialog";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import tabStyles from "@/components/dashboard/MembersTabs.module.css";
import { useToast } from "@/components/ToastProvider";
import {
  bureauCapabilities,
  canAddPlayerToTeam,
  canSeeMemberContact,
} from "@/lib/auth/bureauPermissions";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberFeeStatuses, MemberRoles } from "@/lib/firebase/constants";
import {
  extendMemberGuardianInvite,
  inviteMemberGuardian,
  regenerateMemberGuardianInvite,
  revokeMemberGuardian,
  updateMemberGuardianInviteEmail,
} from "@/lib/firebase/guardianService";
import { sendMemberInvites } from "@/lib/firebase/callableService";
import { applyMemberFeeChanges } from "@/lib/firebase/feeService";
import {
  addMemberWithInvitation,
  assignMemberToTeam,
  buildInviteMessage,
  extendMemberInvitation,
  getLinkedMemberId,
  isMemberInviteValid,
  regenerateMemberInvitation,
  removeMember,
  updateMemberLicense,
  updateMemberRole,
  updatePendingMemberProfile,
  type AddMemberResult,
  type ClubMemberRole,
} from "@/lib/firebase/memberService";
import {
  addMemberToTeam,
  createTeam,
  deleteTeam,
  removeMemberFromTeam,
  updateTeam,
  type TeamRosterRole,
} from "@/lib/firebase/teamService";
import {
  downloadTextFile,
  exportMembersToCsv,
  type MemberImportReport,
  type MembersImportPlan,
} from "@/lib/members/membersCsv";
import {
  feeStatusLabel,
  filterMemberRows,
  loadMembersPageData,
  type MembersFilters,
} from "@/lib/members/membersView";
import {
  buildGuardianInviteMessage,
  filterParentRows,
  membersWithoutParent,
  type ClubParentRow,
  type ParentsFilters,
} from "@/lib/members/parentsView";

const DEFAULT_FILTERS: MembersFilters = {
  search: "",
  role: "all",
  teamId: "all",
  registration: "all",
  feeStatus: "all",
};

const DEFAULT_PARENT_FILTERS: ParentsFilters = {
  search: "",
  status: "all",
};

type MembersTab = "roster" | "parents" | "teams";

/** Contenu page Membres branché sur Firestore. */
function MembersPageContent() {
  const { activeClub, activeClubRole, user } = useAuth();
  const caps = useMemo(
    () => bureauCapabilities(activeClubRole),
    [activeClubRole],
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teamQuery = searchParams.get("team");
  const { showToast } = useToast();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadMembersPageData,
    [],
  );

  const teamIdsSyncToastShownRef = useRef(false);
  const [linkedMemberId, setLinkedMemberId] = useState<string | null>(null);
  const [highlightedTeamId, setHighlightedTeamId] = useState<string | null>(
    null,
  );
  const [membersTab, setMembersTab] = useState<MembersTab>("roster");
  const [filters, setFilters] = useState<MembersFilters>(DEFAULT_FILTERS);
  const [parentFilters, setParentFilters] = useState<ParentsFilters>(
    DEFAULT_PARENT_FILTERS,
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showInviteParent, setShowInviteParent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createdMember, setCreatedMember] = useState<AddMemberResult | null>(
    null,
  );
  const [importReport, setImportReport] = useState<MemberImportReport | null>(
    null,
  );

  useEffect(() => {
    teamIdsSyncToastShownRef.current = false;
    setFilters(DEFAULT_FILTERS);
    setParentFilters(DEFAULT_PARENT_FILTERS);
    setSelectedMemberId(null);
    setSelectedIds(new Set());
    setShowAdd(false);
    setShowImport(false);
    setShowInviteParent(false);
    setActionError(null);
    setCreatedMember(null);
    setImportReport(null);
    setMembersTab("roster");
    setHighlightedTeamId(null);
  }, [activeClub?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadLinked() {
      if (!activeClub || !user) {
        setLinkedMemberId(null);
        return;
      }
      const id = await getLinkedMemberId(activeClub.id, user.uid);
      if (!cancelled) setLinkedMemberId(id);
    }
    void loadLinked();
    return () => {
      cancelled = true;
    };
  }, [activeClub?.id, user?.uid]);

  useEffect(() => {
    if (!teamQuery || !data) return;
    const exists = data.teams.some((team) => team.id === teamQuery);
    if (!exists) {
      router.replace(pathname, { scroll: false });
      return;
    }
    setFilters((current) => ({ ...current, teamId: teamQuery }));
    setHighlightedTeamId(teamQuery);
    setMembersTab("teams");
    router.replace(pathname, { scroll: false });
  }, [teamQuery, data, pathname, router]);

  useEffect(() => {
    if (!caps.canManageParents && membersTab === "parents") {
      setMembersTab("roster");
    }
  }, [caps.canManageParents, membersTab]);

  useEffect(() => {
    if (!data?.teamIdsSynced || teamIdsSyncToastShownRef.current) return;
    teamIdsSyncToastShownRef.current = true;
    showToast("Changement appliqué.", "success");
  }, [data?.teamIdsSynced, showToast]);

  const filteredRows = useMemo(
    () => filterMemberRows(data?.members ?? [], filters),
    [data?.members, filters],
  );

  const selectedInviteableCount = useMemo(() => {
    if (!data) return 0;
    return data.members.filter(
      (row) =>
        selectedIds.has(row.memberId) &&
        !row.hasLinkedAccount &&
        Boolean(row.email?.trim()) &&
        isMemberInviteValid(row),
    ).length;
  }, [data, selectedIds]);

  const filteredParents = useMemo(
    () => filterParentRows(data?.parents ?? [], parentFilters),
    [data?.parents, parentFilters],
  );

  const parentInviteCandidates = useMemo(
    () =>
      membersWithoutParent(
        data?.members ?? [],
        data?.parents ?? [],
      ),
    [data?.members, data?.parents],
  );

  const selectedMember =
    data?.members.find((member) => member.memberId === selectedMemberId) ??
    null;

  function memberContactVisible(member: {
    memberId: string;
    accountUid?: string | null;
  }): boolean {
    return canSeeMemberContact({
      role: activeClubRole,
      viewerUid: user?.uid ?? null,
      viewerLinkedMemberId: linkedMemberId,
      target: member,
      teams: data?.teams ?? [],
    });
  }

  /**
   * Exécute une action membre avec busy / erreur / toast succès partagés.
   * Retourne true si l’action a réussi.
   */
  async function runMemberAction(
    action: () => Promise<void>,
    options: {
      successMessage?: string;
      errorFallback: string;
      /** Si false, n’écrit pas dans actionError (toast erreur à la place). */
      surfaceErrorInPanel?: boolean;
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
      if (options.surfaceErrorInPanel === false) {
        showToast(message, "error");
      } else {
        setActionError(message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteMessage(params: {
    clubName: string;
    code: string;
  }) {
    const message = buildInviteMessage(params);
    try {
      await navigator.clipboard.writeText(message);
      showToast("Message d’invitation copié.", "success");
    } catch {
      showToast("Impossible de copier dans le presse-papiers.", "error");
    }
  }

  async function copyGuardianInvite(row: ClubParentRow) {
    if (!activeClub || !row.primaryInvitationCode) return;
    const message = buildGuardianInviteMessage({
      clubName: activeClub.name,
      code: row.primaryInvitationCode,
      childName: row.children[0]?.displayName,
    });
    try {
      await navigator.clipboard.writeText(message);
      showToast("Message d’invitation parent copié.", "success");
    } catch {
      showToast("Impossible de copier dans le presse-papiers.", "error");
    }
  }

  async function handleAddMember(input: {
    firstName: string;
    lastName: string;
    email: string;
    role: typeof MemberRoles.player | typeof MemberRoles.coach;
  }) {
    if (!activeClub || !user) return;
    await runMemberAction(
      async () => {
        const result = await addMemberWithInvitation({
          clubId: activeClub.id,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          sentByUid: user.uid,
          club: activeClub,
          email: input.email.trim() || undefined,
        });
        setCreatedMember(result);
        reload();
      },
      { errorFallback: "Ajout impossible." },
    );
  }

  async function handleCreateTeam(values: TeamFormValues) {
    if (!activeClub) return;
    const ok = await runMemberAction(
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

  async function handleUpdateTeam(teamId: string, values: TeamFormValues) {
    if (!activeClub) return;
    const ok = await runMemberAction(
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

  async function handleDeleteTeam(teamId: string) {
    if (!activeClub) return;
    await runMemberAction(
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

  async function handleAddTeamMember(params: {
    teamId: string;
    memberId: string;
    role: TeamRosterRole;
  }) {
    if (!activeClub) return;
    if (params.role === MemberRoles.coach && !caps.isAdmin) return;
    if (params.role === MemberRoles.player) {
      const team = data?.teams.find((item) => item.id === params.teamId);
      if (
        !team ||
        !canAddPlayerToTeam({
          role: activeClubRole,
          uid: user?.uid ?? null,
          linkedMemberId,
          team,
        })
      ) {
        return;
      }
    }
    const ok = await runMemberAction(
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

  async function handleRemoveTeamMember(params: {
    teamId: string;
    memberId: string;
    accountUid: string | null;
    role: TeamRosterRole;
  }) {
    if (!activeClub) return;
    await runMemberAction(
      async () => {
        await removeMemberFromTeam({
          clubId: activeClub.id,
          teamId: params.teamId,
          memberId: params.memberId,
          role: params.role,
          accountUid: params.accountUid,
        });
        reload();
      },
      {
        successMessage: "Changement appliqué.",
        errorFallback: "Retrait du roster impossible.",
      },
    );
  }

  async function emailInvite(params: {
    memberId: string;
  }): Promise<boolean> {
    if (!activeClub) return false;
    return runMemberAction(
      async () => {
        const result = await sendMemberInvites({
          clubId: activeClub.id,
          memberIds: [params.memberId],
        });
        if (result.sent > 0) {
          return;
        }
        const first = result.results[0];
        throw new Error(
          first?.reason ?? "Impossible d’envoyer l’invitation.",
        );
      },
      {
        errorFallback: "Envoi de l’invitation impossible.",
        surfaceErrorInPanel: false,
      },
    );
  }

  async function handleSaveLicense(license: string) {
    if (!activeClub || !selectedMember) return;
    await runMemberAction(
      async () => {
        await updateMemberLicense({
          clubId: activeClub.id,
          memberId: selectedMember.memberId,
          license,
        });
        reload();
      },
      {
        successMessage: "Licence enregistrée.",
        errorFallback: "Licence non enregistrée.",
      },
    );
  }

  async function handleSavePendingProfile(input: {
    firstName: string;
    lastName: string;
    email: string;
  }) {
    if (!activeClub || !selectedMember) return;
    await runMemberAction(
      async () => {
        await updatePendingMemberProfile({
          clubId: activeClub.id,
          memberId: selectedMember.memberId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
        });
        reload();
      },
      {
        successMessage: "Identité mise à jour.",
        errorFallback: "Identité non enregistrée.",
      },
    );
  }

  async function handleChangeRole(role: ClubMemberRole) {
    if (!activeClub || !selectedMember) return;
    await runMemberAction(
      async () => {
        await updateMemberRole({
          clubId: activeClub.id,
          memberId: selectedMember.memberId,
          newRole: role,
        });
        reload();
      },
      {
        successMessage: "Rôle mis à jour.",
        errorFallback: "Changement de rôle impossible.",
      },
    );
  }

  async function handleRemoveMember() {
    if (!activeClub || !selectedMember) return;
    await runMemberAction(
      async () => {
        await removeMember({
          clubId: activeClub.id,
          memberId: selectedMember.memberId,
        });
        setSelectedMemberId(null);
        reload();
      },
      {
        successMessage: "Membre supprimé.",
        errorFallback: "Suppression impossible.",
      },
    );
  }

  async function handleExtendInvite() {
    if (!activeClub || !selectedMember) return;
    await runMemberAction(
      async () => {
        const result = await extendMemberInvitation({
          clubId: activeClub.id,
          memberId: selectedMember.memberId,
        });
        showToast(
          `Invitation prolongée jusqu’au ${result.expiresAt.toLocaleDateString("fr-FR")}.`,
          "success",
        );
        reload();
      },
      { errorFallback: "Prolongation impossible." },
    );
  }

  async function handleRegenerateInvite(memberId?: string) {
    const targetMemberId = memberId ?? selectedMember?.memberId;
    if (!activeClub || !targetMemberId || !user) return;
    const targetMember =
      data?.members.find((member) => member.memberId === targetMemberId) ??
      selectedMember;
    const inDetailPanel = selectedMemberId === targetMemberId;

    await runMemberAction(
      async () => {
        const result = await regenerateMemberInvitation({
          clubId: activeClub.id,
          memberId: targetMemberId,
          sentByUid: user.uid,
          club: activeClub,
        });
        showToast(
          targetMember?.pendingInviteCode
            ? `Nouveau code : ${result.code}`
            : `Code créé : ${result.code}`,
          "success",
        );
        reload();
      },
      {
        errorFallback: "Création du code impossible.",
        surfaceErrorInPanel: inDetailPanel,
      },
    );
  }

  async function handleImport(
    plan: MembersImportPlan,
    meta: { sendInvites: boolean },
  ) {
    if (!activeClub || !user || !data) return;
    if (plan.blockingErrors.length > 0) {
      setActionError(
        "Import impossible : le fichier contient des erreurs. Corrigez-le puis réessayez.",
      );
      return;
    }

    setBusy(true);
    setActionError(null);

    const report: MemberImportReport = {
      created: 0,
      updated: 0,
      teamsCreated: 0,
      teamsUpdated: 0,
      failed: 0,
      errors: [],
      warnings: [],
      inviteableMemberIds: [],
      emailsSent: 0,
    };

    const teamsByName = new Map(
      data.teams.map((team) => [
        team.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        { id: team.id, name: team.name, category: team.category },
      ]),
    );

    const normalizeTeamKey = (name: string) =>
      name
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    try {
      let importAborted = false;

      for (const teamAction of plan.teamsToCreate) {
        try {
          const teamId = await createTeam({
            clubId: activeClub.id,
            name: teamAction.name,
            category: teamAction.category,
          });
          teamsByName.set(normalizeTeamKey(teamAction.name), {
            id: teamId,
            name: teamAction.name,
            category: teamAction.category,
          });
          report.teamsCreated += 1;
        } catch (err: unknown) {
          report.failed += 1;
          report.errors.push(
            `Équipe « ${teamAction.name} » : ${
              err instanceof Error ? err.message : "création impossible"
            }. Corrigez puis réessayez.`,
          );
          importAborted = true;
        }
      }

      for (const teamAction of plan.teamsToUpdate) {
        if (importAborted) break;
        if (!teamAction.existingTeamId) continue;
        try {
          await updateTeam({
            clubId: activeClub.id,
            teamId: teamAction.existingTeamId,
            category: teamAction.category,
          });
          const key = normalizeTeamKey(teamAction.name);
          const previous = teamsByName.get(key);
          if (previous) {
            teamsByName.set(key, {
              ...previous,
              category: teamAction.category,
            });
          }
          report.teamsUpdated += 1;
        } catch (err: unknown) {
          report.failed += 1;
          report.errors.push(
            `Équipe « ${teamAction.name} » : ${
              err instanceof Error ? err.message : "mise à jour impossible"
            }. Corrigez puis réessayez.`,
          );
          importAborted = true;
        }
      }

      // Si une équipe a échoué, on ne touche pas aux membres — mais on a déjà
      // listé toutes les erreurs d’équipes rencontrées ci-dessus.
      const existingById = new Map(
        data.members.map((member) => [member.memberId, member]),
      );

      if (!importAborted) {
        for (const action of plan.memberActions) {
          try {
            let memberId = action.existingMemberId;

            if (action.action === "create" || !memberId) {
              const createRole =
                action.role === MemberRoles.admin
                  ? MemberRoles.admin
                  : action.role === MemberRoles.coach
                    ? MemberRoles.coach
                    : MemberRoles.player;

              const result = await addMemberWithInvitation({
                clubId: activeClub.id,
                firstName: action.firstName,
                lastName: action.lastName,
                role: createRole,
                sentByUid: user.uid,
                club: activeClub,
                email: action.email,
              });
              memberId = result.member.memberId;
              report.created += 1;
            } else {
              const existing = existingById.get(memberId);
              if (existing && existing.role !== action.role) {
                await updateMemberRole({
                  clubId: activeClub.id,
                  memberId,
                  newRole: action.role,
                });
              }

              if (existing && !existing.hasLinkedAccount) {
                const nameChanged =
                  existing.firstName.trim() !== action.firstName.trim() ||
                  existing.lastName.trim() !== action.lastName.trim();
                const emailChanged =
                  (existing.email ?? "").trim().toLowerCase() !==
                  action.email.trim().toLowerCase();
                if (nameChanged || emailChanged) {
                  try {
                    await updatePendingMemberProfile({
                      clubId: activeClub.id,
                      memberId,
                      firstName: action.firstName,
                      lastName: action.lastName,
                      email: action.email,
                    });
                  } catch (err: unknown) {
                    report.failed += 1;
                    report.errors.push(
                      `Ligne ${action.lineNumber} : profil non mis à jour (${
                        err instanceof Error ? err.message : "échec"
                      }). Corrigez puis réessayez.`,
                    );
                    importAborted = true;
                    break;
                  }
                }
              } else if (existing?.hasLinkedAccount && action.email.trim()) {
                // Avertissement non bloquant : le compte lié conserve son e-mail.
                report.warnings.push(
                  `Ligne ${action.lineNumber} : e-mail CSV ignoré (membre déjà inscrit).`,
                );
              }

              report.updated += 1;
            }

            if (action.license.trim()) {
              await updateMemberLicense({
                clubId: activeClub.id,
                memberId,
                license: action.license,
              });
            }

            if (
              action.teamName.trim() &&
              action.role !== MemberRoles.admin &&
              memberId
            ) {
              const team = teamsByName.get(normalizeTeamKey(action.teamName));
              if (!team) {
                report.failed += 1;
                report.errors.push(
                  `Ligne ${action.lineNumber} : équipe « ${action.teamName} » introuvable après import. Corrigez puis réessayez.`,
                );
                importAborted = true;
                break;
              }
              const rosterRole =
                action.role === MemberRoles.coach
                  ? MemberRoles.coach
                  : MemberRoles.player;
              const existingMember = existingById.get(memberId);
              const previousAssignments = existingMember
                ? existingMember.resolvedTeamIds
                : [];

              await assignMemberToTeam({
                clubId: activeClub.id,
                memberId,
                teamId: team.id,
                role: rosterRole,
              });

              for (const previousTeamId of previousAssignments) {
                if (previousTeamId === team.id) continue;
                const previousTeam = data.teams.find(
                  (item) => item.id === previousTeamId,
                );
                if (!previousTeam) continue;
                const matchIds = new Set(
                  [
                    existingMember?.memberId,
                    existingMember?.accountUid,
                  ].filter(Boolean) as string[],
                );
                const wasCoach = previousTeam.coachIds.some((id) =>
                  matchIds.has(id),
                );
                const wasPlayer = previousTeam.playerIds.some((id) =>
                  matchIds.has(id),
                );
                if (wasCoach) {
                  await removeMemberFromTeam({
                    clubId: activeClub.id,
                    memberId,
                    teamId: previousTeamId,
                    role: MemberRoles.coach,
                    accountUid: existingMember?.accountUid,
                  });
                }
                if (wasPlayer || (!wasCoach && !wasPlayer)) {
                  await removeMemberFromTeam({
                    clubId: activeClub.id,
                    memberId,
                    teamId: previousTeamId,
                    role: MemberRoles.player,
                    accountUid: existingMember?.accountUid,
                  });
                }
              }
            }

            const shouldQueueInvite =
              Boolean(action.email.trim()) &&
              Boolean(memberId) &&
              (action.action === "create" ||
                !existingById.get(memberId)?.hasLinkedAccount);
            if (shouldQueueInvite && memberId) {
              report.inviteableMemberIds.push(memberId);
            }
          } catch (err: unknown) {
            report.failed += 1;
            report.errors.push(
              `Ligne ${action.lineNumber} : ${
                err instanceof Error ? err.message : "échec"
              }. Corrigez puis réessayez.`,
            );
            importAborted = true;
            break;
          }
        }
      }

      if (importAborted) {
        report.errors.unshift(
          "Import interrompu : certaines écritures ont pu déjà être appliquées. Corrigez les erreurs puis réimportez (les lignes déjà traitées seront mises à jour).",
        );
      } else if (
        meta.sendInvites &&
        report.inviteableMemberIds.length > 0
      ) {
        try {
          const chunkSize = 100;
          for (
            let offset = 0;
            offset < report.inviteableMemberIds.length;
            offset += chunkSize
          ) {
            const chunk = report.inviteableMemberIds.slice(
              offset,
              offset + chunkSize,
            );
            const inviteResult = await sendMemberInvites({
              clubId: activeClub.id,
              memberIds: chunk,
            });
            report.emailsSent += inviteResult.sent;
            if (inviteResult.failed > 0 || inviteResult.skipped > 0) {
              report.warnings.push(
                `E-mails : ${inviteResult.sent} envoyé${inviteResult.sent > 1 ? "s" : ""}, ${inviteResult.skipped} ignoré${inviteResult.skipped > 1 ? "s" : ""}, ${inviteResult.failed} échec${inviteResult.failed > 1 ? "s" : ""}.`,
              );
            }
            for (const item of inviteResult.results) {
              if (item.status === "failed" && item.reason) {
                report.warnings.push(
                  `Invitation ${item.memberId} : ${item.reason}`,
                );
              }
            }
          }
        } catch (err: unknown) {
          report.warnings.push(
            `Envoi des invitations : ${
              err instanceof Error ? err.message : "échec"
            }. Réessayez.`,
          );
        }
      }
    } finally {
      setImportReport(report);
      setBusy(false);
      reload();
    }

    if (report.failed > 0) {
      showToast(
        "Import interrompu : vérifiez le rapport puis corrigez le fichier.",
        "error",
      );
    } else if (report.created > 0 || report.updated > 0 || report.teamsCreated > 0) {
      showToast(
        `Import : ${report.created} créé${report.created > 1 ? "s" : ""}, ${report.updated} mis à jour.`,
        "success",
      );
      if (report.warnings.length > 0) {
        const preview = report.warnings.slice(0, 6);
        const remaining = report.warnings.length - preview.length;
        const message = [
          `Import terminé avec ${report.warnings.length} info${
            report.warnings.length > 1 ? "s" : ""
          } :`,
          ...preview,
          remaining > 0
            ? `… et ${remaining} autre${remaining > 1 ? "s" : ""}.`
            : null,
        ]
          .filter(Boolean)
          .join("\n");
        showToast(message, "info", { sticky: true });
      }
    }
  }

  function handleExport() {
    const csv = exportMembersToCsv(filteredRows);
    const slug = (activeClub?.name ?? "club")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    downloadTextFile({
      filename: `membres-${slug || "club"}.csv`,
      content: csv,
    });
    showToast("Export CSV téléchargé.", "success");
  }

  function toggleSelect(memberId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      const visibleIds = filteredRows.map((row) => row.memberId);
      const allSelected =
        visibleIds.length > 0 &&
        visibleIds.every((memberId) => current.has(memberId));
      const next = new Set(current);
      if (allSelected) {
        for (const memberId of visibleIds) next.delete(memberId);
      } else {
        for (const memberId of visibleIds) next.add(memberId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectedMemberRows() {
    if (!data) return [];
    return data.members.filter((member) => selectedIds.has(member.memberId));
  }

  async function handleBulkSendInvites() {
    if (!activeClub) return;
    const inviteableIds = selectedMemberRows()
      .filter(
        (row) =>
          !row.hasLinkedAccount &&
          Boolean(row.email?.trim()) &&
          isMemberInviteValid(row),
      )
      .map((row) => row.memberId);

    if (inviteableIds.length === 0) {
      showToast("Aucun membre éligible à une invitation e-mail.", "error");
      return;
    }

    setBusy(true);
    try {
      let sent = 0;
      let skipped = 0;
      let failed = 0;
      const chunkSize = 100;
      for (let offset = 0; offset < inviteableIds.length; offset += chunkSize) {
        const chunk = inviteableIds.slice(offset, offset + chunkSize);
        const result = await sendMemberInvites({
          clubId: activeClub.id,
          memberIds: chunk,
        });
        sent += result.sent;
        skipped += result.skipped;
        failed += result.failed;
      }
      showToast(
        `Invitations : ${sent} envoyée${sent > 1 ? "s" : ""}${
          skipped || failed
            ? ` · ${skipped} ignorée${skipped > 1 ? "s" : ""} · ${failed} échec${failed > 1 ? "s" : ""}`
            : ""
        }.`,
        failed > 0 ? "error" : "success",
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Envoi groupé impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkSetFeeStatus(status: string) {
    if (!activeClub || !data?.seasonId) {
      showToast("Aucune saison de cotisation active.", "error");
      return;
    }
    if (
      status !== MemberFeeStatuses.aPayer &&
      status !== MemberFeeStatuses.exonere
    ) {
      return;
    }

    const selectedRows = selectedMemberRows();
    if (selectedRows.length === 0) return;

    const confirmed = window.confirm(
      `Passer ${selectedRows.length} cotisation${selectedRows.length > 1 ? "s" : ""} à « ${feeStatusLabel(status)} » ?`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await applyMemberFeeChanges({
        clubId: activeClub.id,
        seasonId: data.seasonId,
        changes: selectedRows.map((member) => ({
          memberId: member.memberId,
          memberDisplayName: member.displayName,
          status,
          feeExists: member.feeStatus !== null,
        })),
      });
      showToast(
        `Cotisations : ${selectedRows.length} mise${selectedRows.length > 1 ? "s" : ""} à jour.`,
        "success",
      );
      clearSelection();
      reload();
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "Mise à jour groupée des cotisations impossible.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkSetRole(role: string) {
    if (!activeClub) return;
    if (
      role !== MemberRoles.admin &&
      role !== MemberRoles.coach &&
      role !== MemberRoles.player
    ) {
      return;
    }

    const memberIds = [...selectedIds];
    if (memberIds.length === 0) return;

    const roleLabel =
      role === MemberRoles.admin
        ? "Admin"
        : role === MemberRoles.coach
          ? "Coach"
          : "Joueur";
    const confirmed = window.confirm(
      `Passer ${memberIds.length} membre${memberIds.length > 1 ? "s" : ""} en rôle « ${roleLabel} » ?`,
    );
    if (!confirmed) return;

    setBusy(true);
    let ok = 0;
    let failed = 0;
    try {
      for (const memberId of memberIds) {
        try {
          await updateMemberRole({
            clubId: activeClub.id,
            memberId,
            newRole: role,
          });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      showToast(
        `Rôles : ${ok} mise${ok > 1 ? "s" : ""} à jour${
          failed > 0 ? ` · ${failed} échec${failed > 1 ? "s" : ""}` : ""
        }.`,
        failed > 0 ? "error" : "success",
      );
      clearSelection();
      reload();
    } finally {
      setBusy(false);
    }
  }

  function handleBulkExport() {
    const rows = selectedMemberRows();
    if (rows.length === 0) return;
    const csv = exportMembersToCsv(rows);
    const slug = (activeClub?.name ?? "club")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
    downloadTextFile({
      filename: `membres-selection-${slug || "club"}.csv`,
      content: csv,
    });
    showToast("Export de la sélection téléchargé.", "success");
  }

  async function handleInviteParent(input: {
    memberId: string;
    email: string;
  }) {
    if (!activeClub) return;
    const ok = await runMemberAction(
      async () => {
        const result = await inviteMemberGuardian({
          clubId: activeClub.id,
          memberId: input.memberId,
          email: input.email,
        });
        showToast(`Parent invité · code ${result.code}`, "success");
        setShowInviteParent(false);
        reload();
      },
      {
        errorFallback: "Invitation parent impossible.",
        surfaceErrorInPanel: true,
      },
    );
    if (!ok) return;
  }

  async function handleRevokeParent(row: ClubParentRow, childMemberId: string) {
    if (!activeClub) return;
    const child = row.children.find((c) => c.memberId === childMemberId);
    await runMemberAction(
      async () => {
        await revokeMemberGuardian({
          clubId: activeClub.id,
          memberId: childMemberId,
          parentUid: child?.parentUid ?? row.parentUid,
        });
        reload();
      },
      {
        successMessage: "Parent révoqué.",
        errorFallback: "Révocation impossible.",
        surfaceErrorInPanel: false,
      },
    );
  }

  async function handleChangeParentEmail(
    row: ClubParentRow,
    childMemberId: string,
    email: string,
  ) {
    if (!activeClub) return;
    const child = row.children.find((c) => c.memberId === childMemberId);
    await runMemberAction(
      async () => {
        await updateMemberGuardianInviteEmail({
          clubId: activeClub.id,
          memberId: childMemberId,
          email,
          invitationId: child?.invitationId ?? undefined,
        });
        reload();
      },
      {
        successMessage: "E-mail mis à jour.",
        errorFallback: "Changement d’e-mail impossible.",
        surfaceErrorInPanel: false,
      },
    );
  }

  async function handleExtendParentInvite(
    row: ClubParentRow,
    childMemberId: string,
  ) {
    if (!activeClub) return;
    const child = row.children.find((c) => c.memberId === childMemberId);
    await runMemberAction(
      async () => {
        const result = await extendMemberGuardianInvite({
          clubId: activeClub.id,
          memberId: childMemberId,
          invitationId: child?.invitationId ?? undefined,
        });
        showToast(
          `Invitation prolongée jusqu’au ${result.expiresAt.toLocaleDateString("fr-FR")}.`,
          "success",
        );
        reload();
      },
      {
        errorFallback: "Prolongation impossible.",
        surfaceErrorInPanel: false,
      },
    );
  }

  async function handleRegenerateParentInvite(
    row: ClubParentRow,
    childMemberId: string,
  ) {
    if (!activeClub) return;
    const child = row.children.find((c) => c.memberId === childMemberId);
    await runMemberAction(
      async () => {
        const result = await regenerateMemberGuardianInvite({
          clubId: activeClub.id,
          memberId: childMemberId,
          invitationId: child?.invitationId ?? undefined,
        });
        showToast(`Nouveau code : ${result.code}`, "success");
        reload();
      },
      {
        errorFallback: "Renvoi impossible.",
        surfaceErrorInPanel: false,
      },
    );
  }

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <>
      <div className={refreshing ? transitionStyles.refreshing : undefined}>
        <DashboardPageIntro
          eyebrow="Espace club"
          heading="Membres"
          lead={
            membersTab === "roster"
              ? `Gérez les membres de ${activeClub?.name ?? "votre club"}, leurs licences et les invitations.`
              : membersTab === "parents"
                ? `Suivez les invitations et parents connectés de ${activeClub?.name ?? "votre club"}.`
                : `Créez les équipes de ${activeClub?.name ?? "votre club"}, leurs catégories, joueurs et coachs.`
          }
          onRefresh={reload}
          refreshing={refreshing}
        />

        <div className={tabStyles.tabs} role="tablist" aria-label="Membres">
          <button
            type="button"
            role="tab"
            aria-selected={membersTab === "roster"}
            className={`${tabStyles.tab} ${membersTab === "roster" ? tabStyles.tabActive : ""}`}
            onClick={() => setMembersTab("roster")}
          >
            Membres
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={membersTab === "teams"}
            className={`${tabStyles.tab} ${membersTab === "teams" ? tabStyles.tabActive : ""}`}
            onClick={() => {
              setActionError(null);
              setMembersTab("teams");
            }}
          >
            Équipes
          </button>
          {caps.canManageParents ? (
            <button
              type="button"
              role="tab"
              aria-selected={membersTab === "parents"}
              className={`${tabStyles.tab} ${membersTab === "parents" ? tabStyles.tabActive : ""}`}
              onClick={() => setMembersTab("parents")}
            >
              Parents
            </button>
          ) : null}
        </div>

        {error ? (
          <p className={introStyles.lead} role="alert">
            {error}
          </p>
        ) : null}

        {data && membersTab === "roster" ? (
          <MembersTable
            rows={filteredRows}
            teams={data.teams}
            filters={filters}
            selectedMemberId={selectedMemberId}
            selectedIds={selectedIds}
            seasonLabel={data.seasonLabel}
            hasSeason={Boolean(data.seasonId)}
            bulkBusy={busy}
            inviteableSelectedCount={selectedInviteableCount}
            canAddMember={caps.canAddMember}
            canImportMembers={caps.canImportMembers}
            canSelectRows={!caps.isPlayer}
            canInviteActions={caps.canAddMember}
            showAdminBulkActions={caps.isAdmin}
            canSeeContact={memberContactVisible}
            onFiltersChange={setFilters}
            onSelectMember={setSelectedMemberId}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAllVisible}
            onClearSelection={clearSelection}
            onBulkSendInvites={() => {
              void handleBulkSendInvites();
            }}
            onBulkSetFeeStatus={(status) => {
              void handleBulkSetFeeStatus(status);
            }}
            onBulkSetRole={(role) => {
              void handleBulkSetRole(role);
            }}
            onBulkExport={handleBulkExport}
            onCopyInvite={(member) => {
              if (!activeClub || !member.pendingInviteCode) return;
              void copyInviteMessage({
                clubName: activeClub.name,
                code: member.pendingInviteCode,
              });
            }}
            onEmailInvite={(member) =>
              emailInvite({ memberId: member.memberId })
            }
            onRegenerateInvite={(member) => {
              void handleRegenerateInvite(member.memberId);
            }}
            onAddClick={() => {
              setCreatedMember(null);
              setActionError(null);
              setShowAdd(true);
            }}
            onImportClick={() => {
              setImportReport(null);
              setActionError(null);
              setShowImport(true);
            }}
            onExportClick={handleExport}
          />
        ) : null}

        {data && membersTab === "parents" && caps.canManageParents ? (
          <ParentsTable
            rows={filteredParents}
            filters={parentFilters}
            busy={busy}
            onFiltersChange={setParentFilters}
            onInviteClick={() => {
              setActionError(null);
              setShowInviteParent(true);
            }}
            onSelectRosterMember={(memberId) => {
              setMembersTab("roster");
              setSelectedMemberId(memberId);
            }}
            onRevoke={(row, childMemberId) => {
              void handleRevokeParent(row, childMemberId);
            }}
            onChangeEmail={(row, childMemberId, email) => {
              void handleChangeParentEmail(row, childMemberId, email);
            }}
            onCopyInvite={(row) => {
              void copyGuardianInvite(row);
            }}
            onExtendInvite={(row, childMemberId) => {
              void handleExtendParentInvite(row, childMemberId);
            }}
            onRegenerateInvite={(row, childMemberId) => {
              void handleRegenerateParentInvite(row, childMemberId);
            }}
          />
        ) : null}

        {data && membersTab === "teams" && activeClub ? (
          <TeamsPanel
            clubId={activeClub.id}
            teams={data.teams}
            members={data.members}
            sport={activeClub.sport}
            busy={busy}
            error={actionError}
            highlightedTeamId={highlightedTeamId}
            canCreateTeam={caps.canCreateTeam}
            canEditTeam={caps.isAdmin}
            canDeleteTeam={caps.isAdmin}
            canManageCoaches={caps.isAdmin}
            canRemovePlayers={caps.isAdmin}
            canAddPlayerToTeam={(team) =>
              canAddPlayerToTeam({
                role: activeClubRole,
                uid: user?.uid ?? null,
                linkedMemberId,
                team,
              })
            }
            onClearError={() => setActionError(null)}
            onCreateTeam={handleCreateTeam}
            onUpdateTeam={handleUpdateTeam}
            onDeleteTeam={handleDeleteTeam}
            onAddMember={handleAddTeamMember}
            onRemoveMember={handleRemoveTeamMember}
          />
        ) : null}
      </div>

      {selectedMember && activeClub && membersTab === "roster" ? (
        <MemberDetailPanel
          clubId={activeClub.id}
          member={selectedMember}
          busy={busy}
          error={actionError}
          canSeeContact={memberContactVisible(selectedMember)}
          canEditMember={caps.canAddMember}
          canEditRole={caps.canEditRole}
          canRemoveMember={caps.canRemoveMember}
          canManageParents={caps.canManageParents}
          onClose={() => {
            setSelectedMemberId(null);
            setActionError(null);
          }}
          onSaveProfile={handleSavePendingProfile}
          onSaveLicense={handleSaveLicense}
          onChangeRole={handleChangeRole}
          onCopyInvite={() => {
            if (!activeClub || !selectedMember.pendingInviteCode) return;
            void copyInviteMessage({
              clubName: activeClub.name,
              code: selectedMember.pendingInviteCode,
            });
          }}
          onEmailInvite={() =>
            emailInvite({ memberId: selectedMember.memberId })
          }
          onExtendInvite={handleExtendInvite}
          onRegenerateInvite={() => handleRegenerateInvite()}
          onRemove={handleRemoveMember}
          onParentsChanged={() => reload()}
        />
      ) : null}

      {showAdd && caps.canAddMember ? (
        <AddMemberDialog
          busy={busy}
          error={actionError}
          created={createdMember}
          onClose={() => {
            setShowAdd(false);
            setCreatedMember(null);
            setActionError(null);
          }}
          onSubmit={handleAddMember}
          onCopyInvite={() => {
            if (!activeClub || !createdMember) return;
            void copyInviteMessage({
              clubName: activeClub.name,
              code: createdMember.invitation.code,
            });
          }}
          onEmailInvite={async () => {
            if (!createdMember) return false;
            return emailInvite({ memberId: createdMember.member.memberId });
          }}
        />
      ) : null}

      {showImport && data && activeClub && caps.canImportMembers ? (
        <ImportMembersDialog
          sport={activeClub.sport}
          existingMembers={data.members}
          adminIds={activeClub.adminIds}
          teams={data.teams}
          busy={busy}
          error={actionError}
          report={importReport}
          onClose={() => {
            setShowImport(false);
            setImportReport(null);
            setActionError(null);
          }}
          onImport={handleImport}
        />
      ) : null}

      {showInviteParent && caps.canManageParents ? (
        <InviteParentDialog
          busy={busy}
          error={actionError}
          candidates={parentInviteCandidates}
          onClose={() => {
            setShowInviteParent(false);
            setActionError(null);
          }}
          onSubmit={handleInviteParent}
        />
      ) : null}
    </>
  );
}

/** Client Membres (Suspense pour searchParams). */
export function MembersPageClient() {
  return (
    <Suspense fallback={<DashboardSkeleton variant="members" />}>
      <MembersPageContent />
    </Suspense>
  );
}
