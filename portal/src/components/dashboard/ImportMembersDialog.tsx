"use client";

import { ChangeEvent, useMemo, useState } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import { MemberRoles } from "@/lib/firebase/constants";
import { memberRoleLabel } from "@/lib/firebase/memberService";
import {
  buildMembersImportPlan,
  downloadTextFile,
  membersCsvTemplate,
  type MemberImportReport,
  type MembersImportPlan,
} from "@/lib/members/membersCsv";
import {
  downloadMembersExcelTemplate,
  excelFileToCsvText,
} from "@/lib/members/membersExcel";
import { teamCategoriesForSport } from "@/lib/teams/teamCategories";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./ImportMembersDialog.module.css";

type FormatTab = "csv" | "excel" | "other";

const PREVIEW_TEAM_LIMIT = 2;
const PREVIEW_MEMBER_LIMIT = 4;

/** Libellé FR singulier/pluriel selon le compteur (0 et 1 → singulier). */
function pluralLabel(count: number, singular: string, plural: string): string {
  return count > 1 ? plural : singular;
}

/** Props dialog import membres. */
type ImportMembersDialogProps = {
  sport: string;
  existingMembers: Array<{
    memberId: string;
    firstName: string;
    lastName: string;
    role?: string;
    accountUid?: string | null;
  }>;
  /** UIDs admin du club (validation dernier administrateur). */
  adminIds?: string[];
  teams: TeamOption[];
  busy: boolean;
  error: string | null;
  report: MemberImportReport | null;
  onClose: () => void;
  onImport: (
    plan: MembersImportPlan,
    meta: { sendInvites: boolean },
  ) => Promise<void>;
};

/** Aperçu compact des équipes et membres concernés par l’import. */
function ImportPlanPreview({
  plan,
  title = "Prévisualisation",
}: {
  plan: MembersImportPlan;
  title?: string;
}) {
  const previewTeams = [
    ...plan.teamsToCreate.map((team) => ({
      key: `create-${team.name}`,
      name: team.name,
      category: team.category,
      tone: "create" as const,
    })),
    ...plan.teamsToUpdate.map((team) => ({
      key: `update-${team.name}`,
      name: team.name,
      category: team.category,
      tone: "update" as const,
    })),
  ].slice(0, PREVIEW_TEAM_LIMIT);

  const previewMembers = plan.memberActions.slice(0, PREVIEW_MEMBER_LIMIT);
  const remainingTeams =
    plan.teamsToCreate.length + plan.teamsToUpdate.length - previewTeams.length;
  const remainingMembers = plan.memberActions.length - previewMembers.length;

  if (previewTeams.length === 0 && previewMembers.length === 0) {
    return null;
  }

  return (
    <div className={styles.previewSample}>
      <p className={styles.previewSampleTitle}>{title}</p>
      {previewTeams.length > 0 ? (
        <div className={styles.previewSection}>
          <p className={styles.previewSectionLabel}>Équipes</p>
          <ul className={styles.previewCards}>
            {previewTeams.map((team) => (
              <li
                key={team.key}
                className={styles.previewCard}
                data-tone={team.tone}
              >
                <span className={styles.previewCardName}>{team.name}</span>
                <span className={styles.previewCardMeta}>
                  {team.category || "Sans catégorie"}
                </span>
              </li>
            ))}
          </ul>
          {remainingTeams > 0 ? (
            <p className={styles.previewMore}>
              +{remainingTeams} autre{remainingTeams > 1 ? "s" : ""} équipe
              {remainingTeams > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {previewMembers.length > 0 ? (
        <div className={styles.previewSection}>
          <p className={styles.previewSectionLabel}>Membres</p>
          <ul className={styles.previewCards}>
            {previewMembers.map((action) => (
              <li
                key={action.lineNumber}
                className={styles.previewCard}
                data-tone={action.action === "update" ? "update" : "create"}
              >
                <span className={styles.previewCardName}>
                  {action.firstName} {action.lastName}
                </span>
                <span className={styles.previewCardMeta}>
                  {memberRoleLabel(action.role)}
                  {action.teamIgnoredForAdmin
                    ? " · hors équipe"
                    : action.teamName
                      ? ` · ${action.teamName}`
                      : ""}
                </span>
              </li>
            ))}
          </ul>
          {remainingMembers > 0 ? (
            <p className={styles.previewMore}>
              +{remainingMembers} autre
              {remainingMembers > 1 ? "s" : ""} membre
              {remainingMembers > 1 ? "s" : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Compteurs d’un plan d’import (avant confirmation). */
function ImportPlanStats({ plan }: { plan: MembersImportPlan }) {
  const chips = [
    {
      key: "create",
      label: "À créer",
      value: plan.stats.createMembers,
      tone: "ok",
    },
    {
      key: "update",
      label: "À mettre à jour",
      value: plan.stats.updateMembers,
      tone: "warn",
    },
    {
      key: "teamsCreate",
      label: pluralLabel(
        plan.stats.createTeams,
        "Équipe nouvelle",
        "Équipes nouvelles",
      ),
      value: plan.stats.createTeams,
      tone: "ok",
    },
    {
      key: "teamsUpdate",
      label: pluralLabel(
        plan.stats.updateTeams,
        "Équipe maj",
        "Équipes maj",
      ),
      value: plan.stats.updateTeams,
      tone: "warn",
    },
  ].filter((chip) => chip.value > 0);

  if (chips.length === 0) return null;

  return (
    <ul className={styles.statGrid} aria-label="Résumé de l’import">
      {chips.map((chip) => (
        <li key={chip.key} className={styles.statChip} data-tone={chip.tone}>
          <span className={styles.statValue}>{chip.value}</span>
          <span className={styles.statLabel}>{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Compteurs du rapport après exécution. */
function ImportReportStats({ report }: { report: MemberImportReport }) {
  const chips = [
    {
      key: "created",
      label: pluralLabel(report.created, "Créé", "Créés"),
      value: report.created,
      tone: "ok",
    },
    {
      key: "updated",
      label: "Mis à jour",
      value: report.updated,
      tone: "warn",
    },
    {
      key: "teamsCreated",
      label: pluralLabel(
        report.teamsCreated,
        "Équipe créée",
        "Équipes créées",
      ),
      value: report.teamsCreated,
      tone: "ok",
    },
    {
      key: "teamsUpdated",
      label: pluralLabel(
        report.teamsUpdated,
        "Équipe maj",
        "Équipes maj",
      ),
      value: report.teamsUpdated,
      tone: "warn",
    },
    {
      key: "emails",
      label: pluralLabel(report.emailsSent, "Invitation", "Invitations"),
      value: report.emailsSent,
      tone: "info",
    },
    {
      key: "failed",
      label: pluralLabel(report.failed, "Échec", "Échecs"),
      value: report.failed,
      tone: "error",
    },
  ].filter((chip) => chip.value > 0);

  return (
    <ul className={styles.statGrid} aria-label="Résultat de l’import">
      {chips.map((chip) => (
        <li key={chip.key} className={styles.statChip} data-tone={chip.tone}>
          <span className={styles.statValue}>{chip.value}</span>
          <span className={styles.statLabel}>{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Dialog import membres (CSV / Excel / Autres) avec preview et rapport. */
export function ImportMembersDialog({
  sport,
  existingMembers,
  adminIds = [],
  teams,
  busy,
  error,
  report,
  onClose,
  onImport,
}: ImportMembersDialogProps) {
  const [formatTab, setFormatTab] = useState<FormatTab>("csv");
  const [rawCsv, setRawCsv] = useState("");
  const [sendInvites, setSendInvites] = useState(true);
  const [excelReadError, setExcelReadError] = useState<string | null>(null);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      rawCsv.trim()
        ? buildMembersImportPlan({
            content: rawCsv,
            sport,
            existingMembers,
            existingTeams: teams,
            adminIds,
          })
        : null,
    [rawCsv, sport, existingMembers, teams, adminIds],
  );

  const hasBlockingErrors = Boolean(plan && plan.blockingErrors.length > 0);
  const canImport = Boolean(
    plan &&
      plan.blockingErrors.length === 0 &&
      plan.memberActions.length > 0,
  );
  const showImportControls = formatTab === "csv" || formatTab === "excel";

  const allowedCategories =
    plan?.allowedCategories ?? teamCategoriesForSport(sport);
  const categoryExample = allowedCategories[0] ?? "U13";

  function requestClose() {
    if (busy) return;
    onClose();
  }

  function handleCsvFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setExcelReadError(null);
    setExcelFileName(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setRawCsv(String(reader.result ?? ""));
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleExcelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setExcelReadError(null);
    setExcelFileName(file.name);
    setCsvFileName(null);
    try {
      const csvText = await excelFileToCsvText(file);
      setRawCsv(csvText);
    } catch (err: unknown) {
      setRawCsv("");
      setExcelReadError(
        err instanceof Error
          ? err.message
          : "Fichier Excel illisible. Corrigez le fichier puis réessayez.",
      );
    }
  }

  function handleDownloadCsvTemplate() {
    downloadTextFile({
      filename: "modele-membres-viroteam.csv",
      content: `\uFEFF${membersCsvTemplate({ categoryExample })}`,
    });
  }

  function handleDownloadExcelTemplate() {
    downloadMembersExcelTemplate({ categoryExample });
  }

  const principleBlock = (
    <p className={styles.principle} role="note">
      Principe : en cas de conflit, le fichier importé l’emporte sur ce qui
      existe déjà dans le club (membres et équipes). Les données du fichier
      mettent à jour la base ; elles ne sont pas ignorées.
    </p>
  );

  const categoriesBlock = (
    <>
      <p className={styles.categoriesLabel}>
        Catégories autorisées pour ce club ({sport || "sport"}) :
      </p>
      <p className={styles.categories}>{allowedCategories.join(" · ")}</p>
    </>
  );

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <div className={styles.dialogShell}>
        <FadeScrollArea
          className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
          viewportClassName={dialogStyles.body}
          data-tone="amber"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-members-title"
          aria-busy={busy}
          onClick={(mouseEvent) => mouseEvent.stopPropagation()}
        >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Import</p>
            <h2 id="import-members-title" className={dialogStyles.title}>
              Importer des membres
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={busy}
            aria-label="Fermer"
          >
            ×
          </button>
        </header>

        {report ? (
          <div className={styles.report}>
            <div className={styles.reportHeader}>
              <p className={styles.reportStatus} data-tone={report.failed > 0 ? "warn" : "ok"}>
                {report.failed > 0
                  ? "Import terminé avec des erreurs"
                  : "Import terminé"}
              </p>
              <p className={styles.summary}>
                {report.created + report.updated} membre
                {report.created + report.updated > 1 ? "s" : ""} traité
                {report.created + report.updated > 1 ? "s" : ""}
                {report.teamsCreated + report.teamsUpdated > 0
                  ? ` · ${report.teamsCreated + report.teamsUpdated} équipe${
                      report.teamsCreated + report.teamsUpdated > 1 ? "s" : ""
                    }`
                  : ""}
                {report.emailsSent > 0
                  ? ` · ${report.emailsSent} invitation${report.emailsSent > 1 ? "s" : ""} envoyée${report.emailsSent > 1 ? "s" : ""}`
                  : ""}
                .
              </p>
            </div>
            <ImportReportStats report={report} />
            {plan ? <ImportPlanPreview plan={plan} /> : null}
            {report.errors.length > 0 ? (
              <div className={styles.reportErrors} role="alert">
                <p className={styles.previewSectionLabel}>
                  À corriger ({report.errors.length})
                </p>
                <FadeScrollArea className={styles.errorScroll}>
                  <ul className={styles.reportList}>
                    {report.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </FadeScrollArea>
              </div>
            ) : null}
            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.button}
                onClick={requestClose}
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.tabs} role="tablist" aria-label="Format d’import">
              {(
                [
                  { id: "csv", label: "CSV", tone: styles.tabCsv },
                  { id: "excel", label: "Excel", tone: styles.tabExcel },
                  { id: "other", label: "Autres", tone: styles.tabOther },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={formatTab === tab.id}
                  className={`${styles.tab} ${tab.tone} ${
                    formatTab === tab.id ? styles.tabActive : ""
                  }`}
                  onClick={() => setFormatTab(tab.id)}
                  disabled={busy}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {formatTab === "csv" ? (
              <section
                className={styles.help}
                aria-labelledby="import-help-csv-title"
              >
                <h3 id="import-help-csv-title" className={styles.helpTitle}>
                  Format CSV attendu
                </h3>
                {principleBlock}
                <p className={styles.lead}>
                  Colonnes :{" "}
                  <code className={styles.code}>
                    firstName, lastName, role, email, license, team, category
                  </code>
                  . Séparateur <code className={styles.code}>,</code> ou{" "}
                  <code className={styles.code}>;</code>. UTF-8 recommandé
                  (Excel OK avec BOM).
                </p>
                <ul className={styles.helpList}>
                  <li>
                    <strong>role</strong> :{" "}
                    <code className={styles.code}>player</code>,{" "}
                    <code className={styles.code}>coach</code> ou{" "}
                    <code className={styles.code}>admin</code> (alias FR :
                    joueur, entraîneur, administrateur).
                  </li>
                  <li>
                    <strong>team</strong> vide → membre hors équipe. Si rempli,{" "}
                    <strong>category</strong> est obligatoire et doit être une
                    valeur de la liste ci-dessous.
                  </li>
                  <li>
                    Une équipe nommée dans le CSV mais{" "}
                    <strong>pas encore dans le club</strong> est créée. Si ce
                    nom existe déjà dans le club, le fichier met à jour la
                    catégorie et ajoute les joueurs/coachs (sans retirer les
                    autres membres déjà dans l’équipe).
                  </li>
                  <li>
                    Membre déjà présent <strong>dans le club</strong> (même
                    prénom + nom) : le fichier met à jour rôle, e-mail (si pas
                    encore inscrit), licence et équipe.
                  </li>
                  <li>
                    <strong>admin</strong> : créé comme administrateur
                    uniquement. Même avec une colonne team, il n’est pas
                    rattaché automatiquement — ajoutez-le ensuite manuellement
                    dans Équipes si besoin.
                  </li>
                  <li>
                    L’export CSV du tableau n’est pas le même format que
                    l’import (ne réimportez pas un export brut).
                  </li>
                </ul>
                {categoriesBlock}
                <pre className={styles.example} aria-label="Exemple CSV">
                  {membersCsvTemplate({ categoryExample })}
                </pre>
                <div className={styles.templateActions}>
                  <button
                    type="button"
                    className={styles.templateButtonCsv}
                    onClick={handleDownloadCsvTemplate}
                  >
                    Télécharger le modèle CSV
                  </button>
                </div>
              </section>
            ) : null}

            {formatTab === "excel" ? (
              <section
                className={styles.help}
                aria-labelledby="import-help-excel-title"
              >
                <h3 id="import-help-excel-title" className={styles.helpTitle}>
                  Format Excel attendu
                </h3>
                {principleBlock}
                <ol className={styles.helpSteps}>
                  <li>
                    Téléchargez le modèle Excel ci-dessous (ou créez un
                    classeur vide).
                  </li>
                  <li>
                    Remplissez <strong>uniquement la 1ʳᵉ feuille</strong> du
                    fichier. Les autres feuilles sont ignorées.
                  </li>
                  <li>
                    La <strong>première ligne</strong> doit contenir exactement
                    ces en-têtes (dans cet ordre recommandé) :{" "}
                    <code className={styles.code}>firstName</code>,{" "}
                    <code className={styles.code}>lastName</code>,{" "}
                    <code className={styles.code}>role</code>,{" "}
                    <code className={styles.code}>email</code>,{" "}
                    <code className={styles.code}>license</code>,{" "}
                    <code className={styles.code}>team</code>,{" "}
                    <code className={styles.code}>category</code>.
                  </li>
                  <li>
                    Une ligne = un membre. Pas de cellules fusionnées, pas de
                    titre au-dessus des en-têtes, pas de lignes vides au milieu.
                  </li>
                  <li>
                    <strong>role</strong> :{" "}
                    <code className={styles.code}>player</code>,{" "}
                    <code className={styles.code}>coach</code> ou{" "}
                    <code className={styles.code}>admin</code> (ou joueur /
                    entraîneur / administrateur).
                  </li>
                  <li>
                    Si <strong>team</strong> est rempli,{" "}
                    <strong>category</strong> est obligatoire et doit figurer
                    dans la liste des catégories du club ci-dessous. Sinon
                    laissez team et category vides.
                  </li>
                  <li>
                    Les équipes absentes <strong>du club</strong> sont créées ;
                    si le nom existe déjà dans le club, la catégorie est mise à
                    jour et les joueurs/coachs sont ajoutés (sans retirer les
                    autres). Les admins ne sont pas rattachés automatiquement
                    aux équipes.
                  </li>
                  <li>
                    Enregistrez en <strong>.xlsx</strong>, puis choisissez le
                    fichier ci-dessous (pas de collage Excel).
                  </li>
                </ol>
                {categoriesBlock}
                <pre className={styles.example} aria-label="Exemple Excel">
                  {membersCsvTemplate({ categoryExample })}
                </pre>
                <div className={styles.templateActions}>
                  <button
                    type="button"
                    className={styles.templateButtonExcel}
                    onClick={handleDownloadExcelTemplate}
                  >
                    Télécharger le modèle Excel
                  </button>
                </div>
              </section>
            ) : null}

            {formatTab === "other" ? (
              <section
                className={styles.help}
                aria-labelledby="import-help-other-title"
              >
                <h3 id="import-help-other-title" className={styles.helpTitle}>
                  Autres formats (Google Sheets, Numbers, LibreOffice…)
                </h3>
                <p className={styles.lead}>
                  Ces formats ne sont <strong>pas importés directement</strong>.
                  Exportez d’abord en CSV, puis utilisez l’onglet{" "}
                  <strong>CSV</strong>.
                </p>
                <ol className={styles.helpSteps}>
                  <li>
                    Ouvrez votre fichier dans Google Sheets, Numbers,
                    LibreOffice Calc, ou un autre tableur.
                  </li>
                  <li>
                    Exportez / téléchargez au format{" "}
                    <strong>CSV (UTF-8)</strong> — pas ODS, pas PDF, pas le
                    format propriétaire du tableur.
                  </li>
                  <li>
                    Vérifiez que la 1ʳᵉ ligne contient les colonnes :{" "}
                    <code className={styles.code}>
                      firstName, lastName, role, email, license, team, category
                    </code>
                    .
                  </li>
                  <li>
                    Passez à l’onglet <strong>CSV</strong> et suivez
                    exactement les consignes de cet onglet (catégories, rôles,
                    principe fichier prioritaire sur la base).
                  </li>
                </ol>
                <div className={dialogStyles.actions}>
                  <button
                    type="button"
                    className={dialogStyles.button}
                    onClick={() => setFormatTab("csv")}
                    disabled={busy}
                  >
                    Aller à l’onglet CSV
                  </button>
                </div>
              </section>
            ) : null}

            {formatTab === "csv" ? (
              <>
                <div className={dialogStyles.field}>
                  <span className={dialogStyles.label}>Fichier CSV</span>
                  <label
                    className={`${styles.filePicker} ${styles.filePickerCsv} ${
                      csvFileName ? styles.filePickerHasFile : ""
                    } ${busy ? styles.filePickerDisabled : ""}`}
                  >
                    <input
                      className={styles.fileInputHidden}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      disabled={busy}
                    />
                    <span className={styles.filePickerButton}>
                      Choisir un fichier
                    </span>
                    <span className={styles.filePickerName}>
                      {csvFileName ?? "Aucun fichier choisi"}
                    </span>
                  </label>
                </div>
                <label className={dialogStyles.field}>
                  <span className={dialogStyles.label}>Ou coller le CSV</span>
                  <textarea
                    className={styles.textarea}
                    value={rawCsv}
                    onChange={(event) => {
                      setExcelReadError(null);
                      setExcelFileName(null);
                      setCsvFileName(null);
                      setRawCsv(event.target.value);
                    }}
                    placeholder="firstName,lastName,role,email,license,team,category"
                    disabled={busy}
                  />
                </label>
              </>
            ) : null}

            {formatTab === "excel" ? (
              <div className={dialogStyles.field}>
                <span className={dialogStyles.label}>Fichier Excel (.xlsx)</span>
                <label
                  className={`${styles.filePicker} ${styles.filePickerExcel} ${
                    excelFileName ? styles.filePickerHasFile : ""
                  } ${busy ? styles.filePickerDisabled : ""}`}
                >
                  <input
                    className={styles.fileInputHidden}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={(event) => {
                      void handleExcelFileChange(event);
                    }}
                    disabled={busy}
                  />
                  <span className={styles.filePickerButton}>
                    Choisir un fichier
                  </span>
                  <span className={styles.filePickerName}>
                    {excelFileName ?? "Aucun fichier choisi"}
                  </span>
                </label>
              </div>
            ) : null}

            {excelReadError && formatTab === "excel" ? (
              <div className={styles.blockingError} role="alert">
                <p className={styles.blockingTitle}>
                  Fichier Excel illisible. Corrigez le fichier puis réessayez.
                </p>
                <p className={styles.summary}>{excelReadError}</p>
              </div>
            ) : null}

            {showImportControls ? (
              <>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    className={styles.checkInput}
                    checked={sendInvites}
                    onChange={(event) =>
                      setSendInvites(event.target.checked)
                    }
                    disabled={busy}
                  />
                  <span className={styles.checkBox} aria-hidden="true" />
                  <span className={styles.checkLabel}>
                    Envoyer les invitations par e-mail (Brevo) aux lignes avec
                    e-mail
                  </span>
                </label>

                {hasBlockingErrors && plan ? (
                  <div className={styles.blockingError} role="alert">
                    <p className={styles.blockingTitle}>
                      Import impossible : {plan.blockingErrors.length} erreur
                      {plan.blockingErrors.length > 1 ? "s" : ""} détectée
                      {plan.blockingErrors.length > 1 ? "s" : ""}. Corrigez le
                      fichier puis réessayez.
                    </p>
                    <FadeScrollArea className={styles.errorScroll}>
                      <ul className={styles.reportList}>
                        {plan.blockingErrors.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </FadeScrollArea>
                  </div>
                ) : null}

                {canImport && plan ? (
                  <>
                    <div className={styles.previewBox}>
                      <p className={styles.previewLead}>
                        {plan.memberActions.length} membre
                        {plan.memberActions.length > 1 ? "s" : ""} prêt
                        {plan.memberActions.length > 1 ? "s" : ""} à importer
                        {plan.stats.admins > 0
                          ? ` · ${plan.stats.admins} admin${plan.stats.admins > 1 ? "s" : ""}`
                          : ""}
                        {plan.stats.withTeam > 0
                          ? ` · ${plan.stats.withTeam} rattachement${plan.stats.withTeam > 1 ? "s" : ""} équipe`
                          : ""}
                        .
                      </p>
                      <ImportPlanStats plan={plan} />
                      <ImportPlanPreview plan={plan} />
                    </div>
                    <details className={styles.detailToggle}>
                      <summary className={styles.detailSummary}>
                        Voir le détail des lignes (
                        {Math.min(plan.memberActions.length, 50)}
                        {plan.memberActions.length > 50 ? "+" : ""})
                      </summary>
                      <FadeScrollArea className={styles.tableWrap} axis="both">
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Ligne</th>
                              <th>Nom</th>
                              <th>Rôle</th>
                              <th>Équipe</th>
                              <th>Catégorie</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.memberActions.slice(0, 50).map((action) => {
                              const tone =
                                action.action === "update"
                                  ? styles.rowWarn
                                  : styles.rowOk;
                              return (
                                <tr key={action.lineNumber} className={tone}>
                                  <td>{action.lineNumber}</td>
                                  <td>
                                    {action.firstName} {action.lastName}
                                  </td>
                                  <td>{memberRoleLabel(action.role)}</td>
                                  <td>
                                    {action.teamIgnoredForAdmin
                                      ? "— (admin, manuel)"
                                      : action.teamName || "—"}
                                  </td>
                                  <td>{action.category || "—"}</td>
                                  <td>
                                    {action.action === "create"
                                      ? "Créer"
                                      : "Mettre à jour"}
                                    {action.role === MemberRoles.admin &&
                                    action.email
                                      ? " · invitation"
                                      : ""}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </FadeScrollArea>
                    </details>
                  </>
                ) : null}

                {error ? (
                  <p className={dialogStyles.error} role="alert">
                    {error}
                  </p>
                ) : null}

                <div className={dialogStyles.actions}>
                  <button
                    type="button"
                    className={dialogStyles.buttonSecondary}
                    onClick={requestClose}
                    disabled={busy}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className={dialogStyles.button}
                    disabled={busy || !canImport || !plan}
                    onClick={() => {
                      if (!plan || !canImport) return;
                      void onImport(plan, { sendInvites });
                    }}
                  >
                    {busy
                      ? "Import en cours…"
                      : canImport && plan
                        ? `Confirmer l’import (${plan.memberActions.length})`
                        : "Confirmer l’import"}
                  </button>
                </div>
              </>
            ) : (
              <div className={dialogStyles.actions}>
                <button
                  type="button"
                  className={dialogStyles.buttonSecondary}
                  onClick={requestClose}
                  disabled={busy}
                >
                  Fermer
                </button>
              </div>
            )}
          </>
        )}
        </FadeScrollArea>
        {busy ? (
          <div
            className={styles.busyOverlay}
            role="status"
            aria-live="polite"
            aria-busy="true"
            onClick={(mouseEvent) => mouseEvent.stopPropagation()}
          >
            <div className={styles.busyCard}>
              <div className={styles.busySpinner} aria-hidden="true" />
              <p className={styles.busyTitle}>Import en cours…</p>
              <p className={styles.busyHint}>
                {plan
                  ? `Traitement de ${plan.memberActions.length} membre${
                      plan.memberActions.length > 1 ? "s" : ""
                    } et des équipes. Ne fermez pas cette fenêtre.`
                  : "Traitement du fichier en cours. Ne fermez pas cette fenêtre."}
              </p>
              <div className={styles.busyBarTrack} aria-hidden="true">
                <div className={styles.busyBarFill} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
