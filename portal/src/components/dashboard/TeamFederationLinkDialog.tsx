"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { federationCopy as copy } from "@/lib/copy/federationCopy";
import {
  callableErrorMessage,
  linkTeamFederation,
  previewFederationLink,
  type FederationLinkPreview,
} from "@/lib/firebase/callableService";
import type { TeamOption } from "@/lib/firebase/eventService";
import type { ClubMemberRecord } from "@/lib/firebase/memberService";
import {
  looksLikeFfvbPoolLink,
  type TeamFederationLink,
} from "@/lib/standings/standingsTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import {
  ConvocationChecklist,
  type ConvocationChecklistItem,
} from "./ConvocationChecklist";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import styles from "./TeamFederationLinkDialog.module.css";

/** Capture de la page calendrier attendue (même image que l’app). */
const EXAMPLE_IMAGE = "/standings/ffvb_link_example.jpg";

/** Props du dialog de liaison FFVB. */
type TeamFederationLinkDialogProps = {
  clubId: string;
  team: TeamOption;
  membersById: ReadonlyMap<string, ClubMemberRecord>;
  /** Lien actuel (re-liaison) : lien et convoqués par défaut repris. */
  current: TeamFederationLink | null;
  onClose: () => void;
  onLinked: () => void;
};

/** Message d’une erreur de callable (texte du serveur), sinon [fallback]. */

/**
 * Lie une équipe à sa poule FFVB, en deux étapes comme dans l’app :
 * lien collé, vérification et choix de l’équipe dans la poule, puis
 * joueurs convoqués par défaut (tous cochés) et import silencieux.
 */
export function TeamFederationLinkDialog({
  clubId,
  team,
  membersById,
  current,
  onClose,
  onLinked,
}: TeamFederationLinkDialogProps) {
  const { showToast } = useToast();
  const titleId = useId();
  const urlId = useId();
  const errorId = useId();
  const [url, setUrl] = useState(current?.url ?? "");
  const [preview, setPreview] = useState<FederationLinkPreview | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [convocationStep, setConvocationStep] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sparrings : jamais convoqués d’office aux matchs importés (le serveur les
  // exclut), à ajouter match par match.
  const sparrings = useMemo(() => new Set(team.sparringIds), [team.sparringIds]);
  const players = useMemo<ConvocationChecklistItem[]>(
    () =>
      [...new Set(team.playerIds)]
        .map((memberId) => {
          const member = membersById.get(memberId);
          return {
            key: memberId,
            name: member?.displayName ?? "Membre inconnu",
            avatarUrl: member?.avatarUrl ?? null,
            sparring: sparrings.has(memberId),
            locked: sparrings.has(memberId),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [team.playerIds, membersById, sparrings],
  );
  // Re-liaison : reprend les convoqués par défaut mémorisés.
  const [convokedKeys, setConvokedKeys] = useState<Set<string>>(() => {
    const excluded = new Set(current?.excludedMemberIds ?? []);
    return new Set(
      team.playerIds.filter(
        (memberId) => !excluded.has(memberId) && !sparrings.has(memberId),
      ),
    );
  });

  function requestClose() {
    if (busy) return;
    // Échap sur la capture agrandie : ferme seulement la capture.
    if (showExample) {
      setShowExample(false);
      return;
    }
    onClose();
  }

  const dialogRef = useDialogA11y({ onClose: requestClose });

  async function handleCheck(formEvent?: FormEvent<HTMLFormElement>) {
    formEvent?.preventDefault();
    if (busy) return;
    const trimmed = url.trim();
    if (!looksLikeFfvbPoolLink(trimmed)) {
      setError(copy.invalidLink);
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    setSelectedKey(null);
    try {
      const result = await previewFederationLink({
        clubId,
        teamId: team.id,
        url: trimmed,
      });
      setPreview(result);
      const currentKey = current?.teamKey;
      setSelectedKey(
        result.teams.some((poolTeam) => poolTeam.key === currentKey)
          ? currentKey ?? null
          : null,
      );
    } catch (caught) {
      setError(callableErrorMessage(caught, copy.linkCheckUnavailable));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy || !selectedKey) return;
    // Sparrings verrouillés (décochés) : seuls les autres joueurs comptent.
    const convocablePlayers = players.filter((player) => !player.locked);
    if (
      convocationStep &&
      convocablePlayers.length > 0 &&
      convokedKeys.size === 0
    ) {
      setError(copy.keepOnePlayerConvoked);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await linkTeamFederation({
        clubId,
        teamId: team.id,
        url: url.trim(),
        teamKey: selectedKey,
        excludedMemberIds: convocationStep
          ? players
              .filter((player) => !player.sparring)
              .map((player) => player.key)
              .filter((key) => !convokedKeys.has(key))
          : [],
      });
      showToast(copy.imported(result.created), "success");
      onLinked();
      onClose();
    } catch (caught) {
      // Le lien a pu être écrit avant l’échec (import long) : on relit.
      onLinked();
      setError(callableErrorMessage(caught, copy.linkCheckUnavailable));
    } finally {
      setBusy(false);
    }
  }

  /** Après le choix d’équipe : convocations si l’équipe a des joueurs. */
  function handleContinue() {
    if (players.length === 0) {
      void handleImport();
      return;
    }
    setError(null);
    setConvocationStep(true);
  }

  const canImport = preview !== null && selectedKey !== null;

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.target === mouseEvent.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        data-tone="cyan"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className={dialogStyles.header}>
          <div>
            <p className={dialogStyles.eyebrow}>
              {copy.dialogEyebrow} · {team.name}
            </p>
            <h2 id={titleId} className={dialogStyles.title}>
              {convocationStep ? copy.convocationStepTitle : copy.sheetTitle}
            </h2>
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            disabled={busy}
            aria-label={copy.close}
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <div className={`${dialogStyles.body} ${styles.body}`}>
          {convocationStep ? (
            <>
              <p className={dialogStyles.hint}>{copy.convocationStepHelper}</p>
              <p className={styles.later}>{copy.convocationStepLater}</p>
              <ConvocationChecklist
                idPrefix={`federation-${team.id}`}
                items={players}
                checkedKeys={convokedKeys}
                onChange={(next) => {
                  setError(null);
                  setConvokedKeys(next);
                }}
                legend={copy.convocationLegend}
                emptyLabel={copy.teamNoPlayers}
                disabled={busy}
                errorId={errorId}
                invalid={Boolean(error)}
              />
            </>
          ) : (
            <>
              <p className={dialogStyles.hint}>{copy.sheetHelper}</p>
              <div className={styles.example}>
                <button
                  type="button"
                  className={styles.exampleThumb}
                  aria-expanded={showExample}
                  aria-label={copy.exampleImageLabel}
                  onClick={() => setShowExample((shown) => !shown)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- capture statique */}
                  <img src={EXAMPLE_IMAGE} alt="" />
                </button>
                <p className={styles.exampleCaption}>{copy.exampleCaption}</p>
              </div>
              {showExample ? (
                <button
                  type="button"
                  className={styles.exampleFull}
                  aria-label={copy.exampleClose}
                  onClick={() => setShowExample(false)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- capture statique */}
                  <img src={EXAMPLE_IMAGE} alt={copy.exampleImageLabel} />
                </button>
              ) : null}

              <form
                className={styles.urlForm}
                onSubmit={(formEvent) => void handleCheck(formEvent)}
                noValidate
              >
                <label className={dialogStyles.field} htmlFor={urlId}>
                  <span className={dialogStyles.label}>{copy.urlLabel}</span>
                  <input
                    id={urlId}
                    className={styles.input}
                    type="url"
                    inputMode="url"
                    value={url}
                    placeholder={copy.urlHint}
                    disabled={busy}
                    aria-invalid={error && !preview ? true : undefined}
                    aria-describedby={error && !preview ? errorId : undefined}
                    onChange={(changeEvent) => {
                      setUrl(changeEvent.target.value);
                      setError(null);
                      // Lien modifié : l’aperçu ne correspond plus.
                      setPreview(null);
                      setSelectedKey(null);
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className={dialogStyles.buttonSecondary}
                  disabled={busy || !url.trim()}
                  aria-busy={busy && !preview}
                >
                  {busy && !preview ? copy.checkingLink : copy.checkLink}
                </button>
              </form>

              {preview?.poolLabel ? (
                <p className={styles.poolLabel}>{preview.poolLabel}</p>
              ) : null}
              {preview ? (
                <fieldset className={styles.teamFieldset} disabled={busy}>
                  <legend className={styles.teamLegend}>{copy.pickTeam}</legend>
                  <ul className={styles.teamList}>
                    {preview.teams.map((poolTeam) => (
                      <li key={poolTeam.key}>
                        <label
                          className={styles.teamOption}
                          data-selected={
                            selectedKey === poolTeam.key ? "true" : undefined
                          }
                        >
                          <input
                            type="radio"
                            name={`federation-team-${team.id}`}
                            value={poolTeam.key}
                            checked={selectedKey === poolTeam.key}
                            onChange={() => {
                              setError(null);
                              setSelectedKey(poolTeam.key);
                            }}
                          />
                          <span>{poolTeam.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              ) : null}
            </>
          )}

          {error ? (
            <p id={errorId} className={dialogStyles.error} role="alert">
              {error}
            </p>
          ) : null}

          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.buttonSecondary}
              disabled={busy}
              onClick={() => {
                if (convocationStep) {
                  setError(null);
                  setConvocationStep(false);
                } else {
                  requestClose();
                }
              }}
            >
              {convocationStep ? copy.back : copy.cancel}
            </button>
            {convocationStep || (canImport && players.length === 0) ? (
              <button
                type="button"
                className={dialogStyles.button}
                disabled={busy || !canImport}
                aria-busy={busy}
                onClick={() => void handleImport()}
              >
                {busy ? copy.importing : copy.importAction}
              </button>
            ) : (
              <button
                type="button"
                className={dialogStyles.button}
                disabled={busy || !canImport}
                onClick={handleContinue}
              >
                {copy.continueAction}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
