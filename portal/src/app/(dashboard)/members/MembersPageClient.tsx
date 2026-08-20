"use client";

import { useMemo, useState } from "react";
import { AddMemberDialog } from "@/components/dashboard/AddMemberDialog";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ImportMembersDialog } from "@/components/dashboard/ImportMembersDialog";
import { InviteParentDialog } from "@/components/dashboard/InviteParentDialog";
import { MemberDetailPanel } from "@/components/dashboard/MemberDetailPanel";
import { MembersTable } from "@/components/dashboard/MembersTable";
import { ParentsTable } from "@/components/dashboard/ParentsTable";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import tabStyles from "@/components/dashboard/MembersTabs.module.css";
import { useToast } from "@/components/ToastProvider";
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
import { setMemberFeeStatus } from "@/lib/firebase/feeService";
import {
  addMemberWithInvitation,
  assignMemberToTeam,
  buildInviteMessage,
  extendMemberInvitation,
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
  downloadTextFile,
  exportMembersToCsv,
  type MemberImportReport,
  type MemberImportRow,
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

type MembersTab = "roster" | "parents";

/** Contenu page Membres branché sur Firestore. */
export function MembersPageClient() {
  const { activeClub, user } = useAuth();
  const { showToast } = useToast();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadMembersPageData,
    [],
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
    rows: MemberImportRow[],
    meta: { skippedDuplicates: number; sendInvites: boolean },
  ) {
    if (!activeClub || !user || !data) return;
    setBusy(true);
    setActionError(null);

    const report: MemberImportReport = {
      created: 0,
      skipped: meta.skippedDuplicates,
      failed: 0,
      errors: [],
      inviteableMemberIds: [],
      emailsSent: 0,
    };

    const teamsByName = new Map(
      data.teams.map((team) => [team.name.trim().toLowerCase(), team]),
    );

    for (const row of rows) {
      try {
        const result = await addMemberWithInvitation({
          clubId: activeClub.id,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          sentByUid: user.uid,
          club: activeClub,
          email: row.email,
        });

        if (row.license.trim()) {
          await updateMemberLicense({
            clubId: activeClub.id,
            memberId: result.member.memberId,
            license: row.license,
          });
        }

        if (row.teamName.trim()) {
          const team = teamsByName.get(row.teamName.trim().toLowerCase());
          if (team) {
            await assignMemberToTeam({
              clubId: activeClub.id,
              memberId: result.member.memberId,
              teamId: team.id,
              role: row.role,
            });
          } else {
            report.errors.push(
              `Ligne ${row.lineNumber} : équipe « ${row.teamName} » introuvable (membre créé sans équipe).`,
            );
          }
        }

        report.created += 1;
        if (row.email.trim()) {
          report.inviteableMemberIds.push(result.member.memberId);
        }
      } catch (err: unknown) {
        report.failed += 1;
        report.errors.push(
          `Ligne ${row.lineNumber} : ${
            err instanceof Error ? err.message : "échec"
          }`,
        );
      }
    }

    if (meta.sendInvites && report.inviteableMemberIds.length > 0) {
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
            report.errors.push(
              `E-mails : ${inviteResult.sent} envoyé${inviteResult.sent > 1 ? "s" : ""}, ${inviteResult.skipped} ignoré${inviteResult.skipped > 1 ? "s" : ""}, ${inviteResult.failed} échec${inviteResult.failed > 1 ? "s" : ""}.`,
            );
          }
          for (const item of inviteResult.results) {
            if (item.status === "failed" && item.reason) {
              report.errors.push(
                `Invitation ${item.memberId} : ${item.reason}`,
              );
            }
          }
        }
      } catch (err: unknown) {
        report.errors.push(
          `Envoi des invitations : ${
            err instanceof Error ? err.message : "échec"
          }`,
        );
      }
    }

    setImportReport(report);
    setBusy(false);
    reload();
    if (report.created > 0) {
      showToast(
        `${report.created} membre${report.created > 1 ? "s" : ""} importé${report.created > 1 ? "s" : ""}.`,
        "success",
      );
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
      status !== MemberFeeStatuses.partiel &&
      status !== MemberFeeStatuses.paye &&
      status !== MemberFeeStatuses.exonere
    ) {
      return;
    }

    const memberIds = [...selectedIds];
    if (memberIds.length === 0) return;

    const confirmed = window.confirm(
      `Passer ${memberIds.length} cotisation${memberIds.length > 1 ? "s" : ""} à « ${feeStatusLabel(status)} » ?`,
    );
    if (!confirmed) return;

    setBusy(true);
    let ok = 0;
    const failures: string[] = [];
    const memberById = new Map(
      (data.members ?? []).map((member) => [member.memberId, member]),
    );
    try {
      for (const memberId of memberIds) {
        const member = memberById.get(memberId);
        const label = member?.displayName ?? memberId;
        try {
          await setMemberFeeStatus({
            clubId: activeClub.id,
            seasonId: data.seasonId,
            memberId,
            status,
          });
          ok += 1;
        } catch (err: unknown) {
          const reason =
            err instanceof Error ? err.message : "échec inconnu";
          failures.push(`${label} : ${reason}`);
        }
      }
      if (failures.length === 0) {
        showToast(
          `Cotisations : ${ok} mise${ok > 1 ? "s" : ""} à jour.`,
          "success",
        );
      } else {
        const preview = failures.slice(0, 3).join(" · ");
        const more =
          failures.length > 3 ? ` (+${failures.length - 3})` : "";
        showToast(
          `Cotisations : ${ok} ok, ${failures.length} échec${failures.length > 1 ? "s" : ""}. ${preview}${more}`,
          "error",
        );
        console.error("[bulkSetFeeStatus]", failures);
      }
      clearSelection();
      reload();
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
              : `Suivez les invitations et parents connectés de ${activeClub?.name ?? "votre club"}.`
          }
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
            aria-selected={membersTab === "parents"}
            className={`${tabStyles.tab} ${membersTab === "parents" ? tabStyles.tabActive : ""}`}
            onClick={() => setMembersTab("parents")}
          >
            Parents
          </button>
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

        {data && membersTab === "parents" ? (
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
      </div>

      {selectedMember && activeClub && membersTab === "roster" ? (
        <MemberDetailPanel
          clubId={activeClub.id}
          member={selectedMember}
          busy={busy}
          error={actionError}
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

      {showAdd ? (
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

      {showImport && data ? (
        <ImportMembersDialog
          existingMembers={data.members}
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

      {showInviteParent ? (
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
