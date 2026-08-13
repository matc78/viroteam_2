"use client";

import { useMemo, useState } from "react";
import { AddMemberDialog } from "@/components/dashboard/AddMemberDialog";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { ImportMembersDialog } from "@/components/dashboard/ImportMembersDialog";
import { MemberDetailPanel } from "@/components/dashboard/MemberDetailPanel";
import { MembersTable } from "@/components/dashboard/MembersTable";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import { useToast } from "@/components/ToastProvider";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberRoles } from "@/lib/firebase/constants";
import {
  addMemberWithInvitation,
  assignMemberToTeam,
  buildInviteMessage,
  extendMemberInvitation,
  regenerateMemberInvitation,
  removeMember,
  updateMemberLicense,
  updateMemberRole,
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
  filterMemberRows,
  loadMembersPageData,
  type MembersFilters,
} from "@/lib/members/membersView";

const DEFAULT_FILTERS: MembersFilters = {
  search: "",
  role: "all",
  teamId: "all",
  registration: "all",
  feeStatus: "all",
};

/** Contenu page Membres branché sur Firestore. */
export function MembersPageClient() {
  const { activeClub, user } = useAuth();
  const { showToast } = useToast();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    loadMembersPageData,
    [],
  );

  const [filters, setFilters] = useState<MembersFilters>(DEFAULT_FILTERS);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  async function handleAddMember(input: {
    firstName: string;
    lastName: string;
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
        });
        setCreatedMember(result);
        reload();
      },
      { errorFallback: "Ajout impossible." },
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
    meta: { skippedDuplicates: number },
  ) {
    if (!activeClub || !user || !data) return;
    setBusy(true);
    setActionError(null);

    const report: MemberImportReport = {
      created: 0,
      skipped: meta.skippedDuplicates,
      failed: 0,
      errors: [],
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
      } catch (err: unknown) {
        report.failed += 1;
        report.errors.push(
          `Ligne ${row.lineNumber} : ${
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

  if (loading && !data) {
    return <DashboardSkeleton variant="members" />;
  }

  return (
    <>
      <div className={refreshing ? transitionStyles.refreshing : undefined}>
        <DashboardPageIntro
          eyebrow="Espace club"
          heading="Membres"
          lead={`Gérez les membres de ${activeClub?.name ?? "votre club"}, leurs licences et les invitations.`}
        />

        {error ? (
          <p className={introStyles.lead} role="alert">
            {error}
          </p>
        ) : null}

        {data ? (
          <MembersTable
            rows={filteredRows}
            teams={data.teams}
            filters={filters}
            selectedMemberId={selectedMemberId}
            seasonLabel={data.seasonLabel}
            onFiltersChange={setFilters}
            onSelectMember={setSelectedMemberId}
            onCopyInvite={(member) => {
              if (!activeClub || !member.pendingInviteCode) return;
              void copyInviteMessage({
                clubName: activeClub.name,
                code: member.pendingInviteCode,
              });
            }}
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
      </div>

      {selectedMember ? (
        <MemberDetailPanel
          member={selectedMember}
          busy={busy}
          error={actionError}
          onClose={() => {
            setSelectedMemberId(null);
            setActionError(null);
          }}
          onSaveLicense={handleSaveLicense}
          onChangeRole={handleChangeRole}
          onCopyInvite={() => {
            if (!activeClub || !selectedMember.pendingInviteCode) return;
            void copyInviteMessage({
              clubName: activeClub.name,
              code: selectedMember.pendingInviteCode,
            });
          }}
          onExtendInvite={handleExtendInvite}
          onRegenerateInvite={() => handleRegenerateInvite()}
          onRemove={handleRemoveMember}
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
    </>
  );
}
