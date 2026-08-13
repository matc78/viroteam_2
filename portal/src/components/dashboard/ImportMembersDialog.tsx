"use client";

import { ChangeEvent, useMemo, useState } from "react";
import type { TeamOption } from "@/lib/firebase/eventService";
import { memberRoleLabel } from "@/lib/firebase/memberService";
import {
  downloadTextFile,
  membersCsvTemplate,
  parseMembersCsv,
  type MemberImportReport,
  type MemberImportRow,
} from "@/lib/members/membersCsv";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./ImportMembersDialog.module.css";

/** Props dialog import CSV. */
type ImportMembersDialogProps = {
  existingMembers: Array<{ firstName: string; lastName: string }>;
  teams: TeamOption[];
  busy: boolean;
  error: string | null;
  report: MemberImportReport | null;
  onClose: () => void;
  onImport: (
    rows: MemberImportRow[],
    meta: { skippedDuplicates: number },
  ) => Promise<void>;
};

/** Dialog import CSV membres avec preview et rapport. */
export function ImportMembersDialog({
  existingMembers,
  teams,
  busy,
  error,
  report,
  onClose,
  onImport,
}: ImportMembersDialogProps) {
  const [rawCsv, setRawCsv] = useState("");
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  const previewRows = useMemo(
    () => (rawCsv.trim() ? parseMembersCsv(rawCsv, existingMembers) : []),
    [rawCsv, existingMembers],
  );

  const validCount = previewRows.filter((row) => !row.error).length;
  const errorCount = previewRows.filter((row) => row.error).length;
  const duplicateCount = previewRows.filter((row) => row.duplicate).length;

  function requestClose() {
    if (busy) return;
    onClose();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawCsv(String(reader.result ?? ""));
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDownloadTemplate() {
    downloadTextFile({
      filename: "modele-membres-viroteam.csv",
      content: `\uFEFF${membersCsvTemplate()}`,
    });
  }

  const importableRows = previewRows.filter((row) => {
    if (row.error) return false;
    if (skipDuplicates && row.duplicate) return false;
    return true;
  });

  const skippedDuplicates = skipDuplicates
    ? previewRows.filter((row) => !row.error && row.duplicate).length
    : 0;

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") requestClose();
      }}
    >
      <div
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="amber"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-members-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>Import</p>
            <h2 id="import-members-title" className={dialogStyles.title}>
              Importer des membres (CSV)
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
            <p className={styles.summary}>
              Import terminé : {report.created} créé
              {report.created > 1 ? "s" : ""}, {report.skipped} ignoré
              {report.skipped > 1 ? "s" : ""}, {report.failed} échec
              {report.failed > 1 ? "s" : ""}.
            </p>
            {report.errors.length > 0 ? (
              <ul className={styles.reportList}>
                {report.errors.slice(0, 8).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
            <p className={styles.lead}>
              Colonnes : firstName, lastName, role (player|coach), email,
              license, team. L’équipe n’est rattachée que si le nom existe déjà
              dans le club ({teams.length} équipe
              {teams.length > 1 ? "s" : ""}).
            </p>

            <div className={dialogStyles.actions}>
              <button
                type="button"
                className={dialogStyles.buttonSecondary}
                onClick={handleDownloadTemplate}
              >
                Télécharger le modèle
              </button>
            </div>

            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Fichier CSV</span>
              <input
                className={styles.fileInput}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={busy}
              />
            </label>

            <label className={dialogStyles.field}>
              <span className={dialogStyles.label}>Ou coller le CSV</span>
              <textarea
                className={styles.textarea}
                value={rawCsv}
                onChange={(event) => setRawCsv(event.target.value)}
                placeholder="firstName,lastName,role,email,license,team"
                disabled={busy}
              />
            </label>

            <label className={dialogStyles.field}>
              <span>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(event) => setSkipDuplicates(event.target.checked)}
                  disabled={busy}
                />{" "}
                Ignorer les doublons (même prénom + nom)
              </span>
            </label>

            {previewRows.length > 0 ? (
              <>
                <p className={styles.summary}>
                  Aperçu : {validCount} valide
                  {validCount > 1 ? "s" : ""}, {duplicateCount} doublon
                  {duplicateCount > 1 ? "s" : ""}, {errorCount} erreur
                  {errorCount > 1 ? "s" : ""} · {importableRows.length} à
                  importer
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Ligne</th>
                        <th>Nom</th>
                        <th>Rôle</th>
                        <th>Licence</th>
                        <th>Équipe</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 40).map((row) => {
                        const tone = row.error
                          ? styles.rowError
                          : row.duplicate
                            ? styles.rowWarn
                            : styles.rowOk;
                        return (
                          <tr key={row.lineNumber} className={tone}>
                            <td>{row.lineNumber}</td>
                            <td>
                              {row.firstName} {row.lastName}
                            </td>
                            <td>{memberRoleLabel(row.role)}</td>
                            <td>{row.license || "—"}</td>
                            <td>{row.teamName || "—"}</td>
                            <td>
                              {row.error
                                ? row.error
                                : row.duplicate
                                  ? "Doublon"
                                  : "OK"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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
                disabled={busy || importableRows.length === 0}
                onClick={() =>
                  void onImport(importableRows, { skippedDuplicates })
                }
              >
                {busy
                  ? "Import en cours…"
                  : `Importer ${importableRows.length} membre${importableRows.length > 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
