"use client";

import { FormEvent, useEffect, useState } from "react";
import { validateEmail } from "@/lib/auth/validateEmail";
import {
  firstNameError,
  lastNameError,
  licenseError,
} from "@/lib/format/personDataFormat";
import {
  getMemberGuardian,
  inviteMemberGuardian,
  revokeMemberGuardian,
  type MemberGuardianView,
} from "@/lib/firebase/guardianService";
import { isMemberInviteValid } from "@/lib/firebase/memberService";
import { badgeLabel } from "@/lib/copy/badgeCopy";
import {
  isAdminMember,
  type ClubPermission,
} from "@/lib/auth/permissions";
import { permissionsCopy } from "@/lib/copy/permissionsCopy";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { MemberPermissionsEditor } from "./MemberPermissionsEditor";
import type { MemberRow } from "@/lib/members/membersView";
import { FadeScrollArea } from "@/components/dashboard/FadeScrollArea";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import panelStyles from "./DashboardPanel.module.css";
import dialogStyles from "./DashboardDialog.module.css";
import { SettingRows, ToggleRow } from "@/components/ui/ToggleRow";
import { InviteEmailButton } from "./InviteEmailButton";
import { MemberAvatar } from "./MemberAvatar";
import styles from "./MemberDetailPanel.module.css";

/** Props du panneau détail membre. */
type MemberDetailPanelProps = {
  clubId: string;
  member: MemberRow;
  busy: boolean;
  error: string | null;
  /** Affiche l’e-mail (sinon masqué). */
  canSeeContact?: boolean;
  /** Édition profil / invitations. */
  canEditMember?: boolean;
  /** Édition de la licence (`canEditMemberLicense`). */
  canEditLicense?: boolean;
  /** Attribuer des droits (droit Administrateur, jamais sur sa propre fiche). */
  canEditRights?: boolean;
  /** Fiche du compte connecté : ses droits restent visibles, non modifiables. */
  isOwnProfile?: boolean;
  /** Retirer un admin exige le droit Administrateur. */
  canRemoveMember?: boolean;
  canManageParents?: boolean;
  /** Bascule sparring possible sur cette équipe (droit d’ajout de joueurs). */
  canToggleSparring?: (teamId: string) => boolean;
  onSetSparring?: (teamId: string, sparring: boolean) => Promise<void>;
  onClose: () => void;
  onSaveProfile: (input: {
    firstName: string;
    lastName: string;
    email: string;
  }) => Promise<void>;
  onSaveLicense: (license: string) => Promise<void>;
  onChangePermissions: (permissions: ClubPermission[]) => Promise<void>;
  onCopyInvite: () => void;
  onEmailInvite: () => Promise<boolean>;
  onExtendInvite: () => Promise<void>;
  onRegenerateInvite: () => Promise<void>;
  onRemove: () => Promise<void>;
  /** Après mutation parent (invite / révocation) pour rafraîchir l’onglet Parents. */
  onParentsChanged?: () => void;
};

/** Fiche membre : Statut, Accès, Admin, Danger. */
export function MemberDetailPanel({
  clubId,
  member,
  busy,
  error,
  canSeeContact = false,
  canEditMember = false,
  canEditLicense = false,
  canEditRights = false,
  isOwnProfile = false,
  canRemoveMember = false,
  canManageParents = false,
  canToggleSparring,
  onSetSparring,
  onClose,
  onSaveProfile,
  onSaveLicense,
  onChangePermissions,
  onCopyInvite,
  onEmailInvite,
  onExtendInvite,
  onRegenerateInvite,
  onRemove,
  onParentsChanged,
}: MemberDetailPanelProps) {
  const { activeClub } = useAuth();
  const isTeamCoach = member.coachTeamIds.length > 0;
  const coachedTeamNames = member.teamLabels
    .filter((label) => label.includes("(coach"))
    .map((label) => label.replace(/\s*\([^)]*\)$/, "").trim());
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [email, setEmail] = useState(member.email ?? "");
  const [license, setLicense] = useState(member.license);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [guardian, setGuardian] = useState<MemberGuardianView | null>(null);
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianBusy, setGuardianBusy] = useState(false);
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);

  useEffect(() => {
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setEmail(member.email ?? "");
    setLicense(member.license);
    setConfirmRemove(false);
    setGuardianEmail("");
    setGuardianError(null);
    setProfileError(null);
    setEditingName(false);
    setEditingEmail(false);
  }, [
    member.memberId,
    member.firstName,
    member.lastName,
    member.email,
    member.license,
  ]);

  useEffect(() => {
    if (!canManageParents) {
      setGuardian(null);
      return;
    }
    let cancelled = false;
    void getMemberGuardian(clubId, member.memberId)
      .then((view) => {
        if (!cancelled) setGuardian(view);
      })
      .catch(() => {
        if (!cancelled) setGuardian(null);
      });
    return () => {
      cancelled = true;
    };
  }, [clubId, member.memberId, canManageParents]);

  function requestClose() {
    if (busy || guardianBusy) return;
    onClose();
  }

  const dialogRef = useDialogA11y({ onClose: requestClose });

  function startEditingName() {
    if (busy || guardianBusy || member.hasLinkedAccount || !canEditMember) return;
    setEmail(member.email ?? "");
    setProfileError(null);
    setEditingEmail(false);
    setEditingName(true);
  }

  function cancelEditingName() {
    if (busy || guardianBusy) return;
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setProfileError(null);
    setEditingName(false);
  }

  function startEditingEmail() {
    if (
      busy ||
      guardianBusy ||
      member.hasLinkedAccount ||
      !canEditMember ||
      !canSeeContact
    ) {
      return;
    }
    setFirstName(member.firstName);
    setLastName(member.lastName);
    setEmail(member.email ?? "");
    setProfileError(null);
    setEditingName(false);
    setEditingEmail(true);
  }

  function cancelEditingEmail() {
    if (busy || guardianBusy) return;
    setEmail(member.email ?? "");
    setProfileError(null);
    setEditingEmail(false);
  }

  async function handleNameSubmit(event: FormEvent) {
    event.preventDefault();
    const firstError = firstNameError(firstName);
    const lastError = lastNameError(lastName);
    if (firstError || lastError) {
      setProfileError(firstError ?? lastError ?? "Identité invalide.");
      return;
    }
    if (
      firstName.trim() === member.firstName.trim() &&
      lastName.trim() === member.lastName.trim()
    ) {
      setEditingName(false);
      return;
    }
    setProfileError(null);
    await onSaveProfile({
      firstName,
      lastName,
      email: (member.email ?? "").trim(),
    });
    setEditingName(false);
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    // E-mail obligatoire : l’invitation ne peut être acceptée que par cette adresse.
    const trimmedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(trimmedEmail);
    if (emailError) {
      setProfileError(emailError);
      return;
    }
    if (trimmedEmail === (member.email ?? "").trim().toLowerCase()) {
      setEditingEmail(false);
      return;
    }
    setProfileError(null);
    await onSaveProfile({
      firstName: member.firstName,
      lastName: member.lastName,
      email: trimmedEmail,
    });
    setEditingEmail(false);
  }

  async function handleLicenseSubmit(event: FormEvent) {
    event.preventDefault();
    const error = licenseError(license);
    if (error) {
      setProfileError(error);
      return;
    }
    setProfileError(null);
    await onSaveLicense(license);
  }

  async function reloadGuardian() {
    const view = await getMemberGuardian(clubId, member.memberId);
    setGuardian(view);
  }

  async function handleInviteParent(event: FormEvent) {
    event.preventDefault();
    const emailError = validateEmail(guardianEmail);
    if (emailError) {
      setGuardianError(emailError);
      return;
    }
    setGuardianBusy(true);
    setGuardianError(null);
    try {
      await inviteMemberGuardian({
        clubId,
        memberId: member.memberId,
        email: guardianEmail.trim(),
      });
      setGuardianEmail("");
      await reloadGuardian();
      onParentsChanged?.();
    } catch (err: unknown) {
      setGuardianError(
        err instanceof Error ? err.message : "Invitation parent impossible.",
      );
    } finally {
      setGuardianBusy(false);
    }
  }

  async function handleRevokeParent() {
    setGuardianBusy(true);
    setGuardianError(null);
    try {
      await revokeMemberGuardian({
        clubId,
        memberId: member.memberId,
        parentUid: guardian?.parentUid,
      });
      await reloadGuardian();
      onParentsChanged?.();
    } catch (err: unknown) {
      setGuardianError(
        err instanceof Error ? err.message : "Révocation impossible.",
      );
    } finally {
      setGuardianBusy(false);
    }
  }

  const panelBusy = busy || guardianBusy;
  const isPending = !member.hasLinkedAccount;
  const showInviteActions = isPending && canEditMember;
  const hasValidInvite = isMemberInviteValid(member);
  const inviteExpired =
    Boolean(member.pendingInviteCode) &&
    member.pendingInviteExpiresAt != null &&
    !hasValidInvite;
  const canEmailInvite = Boolean(member.email?.trim()) && hasValidInvite;
  const teamsLabel =
    member.teamLabels.length > 0
      ? member.teamLabels.join(", ")
      : "Aucune";
  const emailDisplay = canSeeContact
    ? member.email?.trim() || "—"
    : "—";
  const showAdminSection =
    canEditMember || canEditLicense || canEditRights || isOwnProfile;
  const showDangerSection = canRemoveMember;
  const sparringTeams = onSetSparring
    ? member.playerTeams.filter((team) => canToggleSparring?.(team.teamId))
    : [];

  return (
    <div
      className={dialogStyles.backdrop}
      role="presentation"
      onClick={requestClose}
    >
      <FadeScrollArea
        wrapRef={dialogRef}
        className={`${panelStyles.panel} ${dialogStyles.panel} ${styles.panel}`}
        viewportClassName={`${dialogStyles.body} ${styles.panelContent}`}
        data-tone="blue"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-detail-title"
        onClick={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <header className={dialogStyles.header}>
          <div className={styles.headerMain}>
            <p className={dialogStyles.eyebrow}>
              {badgeLabel(member.badge)}
            </p>
            {editingName ? (
              <form
                id="member-detail-title"
                className={styles.nameEditForm}
                onSubmit={handleNameSubmit}
              >
                <input
                  className={styles.input}
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={panelBusy}
                  required
                  autoComplete="off"
                  autoFocus
                  aria-label="Prénom"
                  placeholder="Prénom"
                />
                <input
                  className={styles.input}
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={panelBusy}
                  required
                  autoComplete="off"
                  aria-label="Nom"
                  placeholder="Nom"
                />
                <button
                  type="submit"
                  className={`${styles.iconAction} ${styles.iconConfirm}`}
                  disabled={panelBusy}
                  aria-label="Enregistrer le nom"
                  title="Enregistrer"
                >
                  <ThumbUpIcon />
                </button>
                <button
                  type="button"
                  className={`${styles.iconAction} ${styles.iconCancel}`}
                  disabled={panelBusy}
                  onClick={cancelEditingName}
                  aria-label="Annuler"
                  title="Annuler"
                >
                  <CrossIcon />
                </button>
              </form>
            ) : (
              <div className={styles.titleRow}>
                <MemberAvatar
                  displayName={member.displayName}
                  avatarUrl={member.avatarUrl}
                  hasLinkedAccount={member.hasLinkedAccount}
                />
                <h2 id="member-detail-title" className={dialogStyles.title}>
                  {member.displayName}
                </h2>
                {isPending && canEditMember ? (
                  <button
                    type="button"
                    className={styles.pencilButton}
                    onClick={startEditingName}
                    disabled={panelBusy}
                    aria-label="Modifier le prénom et le nom"
                    title="Modifier le prénom et le nom"
                  >
                    <PencilIcon />
                  </button>
                ) : null}
              </div>
            )}
            {profileError && editingName ? (
              <p className={dialogStyles.error} role="alert">
                {profileError}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={requestClose}
            disabled={panelBusy}
            aria-label="Fermer la fiche"
          >
            ×
          </button>
        </header>

        <section className={styles.section} data-tone="blue">
          <h3 className={styles.sectionTitle}>Statut</h3>
          <div className={styles.sectionBody}>
            <div className={styles.metaChips}>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Inscription</span>
                <span className={styles.metaChipValue}>
                  {member.hasLinkedAccount ? "Compte lié" : "Pas encore inscrit"}
                </span>
              </div>
              <div className={`${styles.metaChip} ${styles.metaChipEmail}`}>
                <span className={styles.metaChipLabel}>Email</span>
                {editingEmail ? (
                  <form
                    className={styles.emailEditForm}
                    onSubmit={handleEmailSubmit}
                  >
                    <input
                      className={styles.emailEditInput}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={panelBusy}
                      autoFocus
                      placeholder="e-mail (optionnel)"
                      aria-label="E-mail"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      className={`${styles.iconAction} ${styles.iconConfirm}`}
                      disabled={panelBusy}
                      aria-label="Enregistrer l’e-mail"
                      title="Enregistrer"
                    >
                      <ThumbUpIcon />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconAction} ${styles.iconCancel}`}
                      disabled={panelBusy}
                      onClick={cancelEditingEmail}
                      aria-label="Annuler"
                      title="Annuler"
                    >
                      <CrossIcon />
                    </button>
                  </form>
                ) : (
                  <div className={styles.metaChipValueRow}>
                    <span
                      className={styles.metaChipValue}
                      title={member.email?.trim() || undefined}
                    >
                      {emailDisplay}
                    </span>
                    {isPending && canEditMember && canSeeContact ? (
                      <button
                        type="button"
                        className={styles.pencilButton}
                        onClick={startEditingEmail}
                        disabled={panelBusy}
                        aria-label="Modifier l’e-mail"
                        title="Modifier l’e-mail"
                      >
                        <PencilIcon />
                      </button>
                    ) : null}
                  </div>
                )}
                {profileError && editingEmail ? (
                  <p className={dialogStyles.error} role="alert">
                    {profileError}
                  </p>
                ) : null}
              </div>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Équipes</span>
                <span className={styles.metaChipValue}>{teamsLabel}</span>
              </div>
              <div className={styles.metaChip}>
                <span className={styles.metaChipLabel}>Cotisation</span>
                <span className={styles.metaChipValue}>{member.feeStatusLabel}</span>
              </div>
            </div>
          </div>
        </section>

        {sparringTeams.length > 0 && onSetSparring ? (
          <section className={styles.section} data-tone="blue">
            <h3 className={styles.sectionTitle}>Sparring</h3>
            <div className={styles.sectionBody}>
              <SettingRows>
                {sparringTeams.map((team) => (
                  <ToggleRow
                    key={team.teamId}
                    label={team.teamName}
                    description="Sparring : s’entraîne avec l’équipe, pas convoqué d’office aux matchs."
                    checked={team.sparring}
                    disabled={panelBusy}
                    onChange={(sparring) => void onSetSparring(team.teamId, sparring)}
                  />
                ))}
              </SettingRows>
            </div>
          </section>
        ) : null}

        {(canManageParents || showInviteActions) ? (
          <section className={styles.section} data-tone="amber">
            <h3 className={styles.sectionTitle}>Accès</h3>
            <div className={styles.sectionBody}>
              <div
                className={`${styles.accessGrid}${
                  showInviteActions && canManageParents
                    ? ""
                    : ` ${styles.accessGridSingle}`
                }`}
              >
                {canManageParents ? (
                  <div className={styles.accessColumn}>
                    <p className={styles.blockLabel}>Parent</p>
                    <div className={styles.accessLead}>
                      {guardian?.status ? (
                        <>
                          <p className={styles.inviteCode}>
                            {guardian.displayName ||
                              guardian.email ||
                              "Parent invité"}
                            {guardian.inviteExpired
                              ? " · invitation expirée"
                              : guardian.status === "pending"
                                ? " · en attente"
                                : ""}
                          </p>
                          {guardian.invitationCode ? (
                            <p className={styles.inviteMeta}>
                              Code : {guardian.invitationCode}
                              {guardian.expiresAt
                                ? ` · ${guardian.inviteExpired ? "expiré" : "expire"} le ${guardian.expiresAt.toLocaleDateString("fr-FR")}`
                                : ""}
                            </p>
                          ) : null}
                        </>
                      ) : guardianError ? (
                        <p className={styles.centeredNote} role="alert">
                          {guardianError}
                        </p>
                      ) : (
                        <p className={styles.centeredNote}>
                          Un parent par enfant — planning, RSVP et cotisation.
                        </p>
                      )}
                    </div>
                    <div className={styles.accessActions}>
                      {guardian?.status ? (
                        <button
                          type="button"
                          className={dialogStyles.buttonSecondary}
                          disabled={panelBusy}
                          onClick={() => void handleRevokeParent()}
                        >
                          {guardianBusy ? "Révocation…" : "Révoquer"}
                        </button>
                      ) : (
                        <form
                          className={styles.row}
                          onSubmit={handleInviteParent}
                        >
                          <input
                            className={styles.input}
                            type="email"
                            value={guardianEmail}
                            onChange={(event) =>
                              setGuardianEmail(event.target.value)
                            }
                            placeholder="email du parent"
                            disabled={panelBusy}
                            aria-label="E-mail du parent"
                          />
                          <button
                            type="submit"
                            className={`${dialogStyles.buttonSecondary} ${styles.rowAction}`}
                            disabled={panelBusy}
                          >
                            {guardianBusy ? "Invitation…" : "Inviter"}
                          </button>
                        </form>
                      )}
                    </div>
                    <div className={styles.accessFooter}>
                      {guardianError && guardian?.status ? (
                        <p className={styles.centeredNote} role="alert">
                          {guardianError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {showInviteActions ? (
                  <div className={styles.accessColumn}>
                    <p className={styles.blockLabel}>Code invitation</p>
                    <div className={styles.accessLead}>
                      {member.pendingInviteCode ? (
                        <>
                          <p className={styles.inviteCode}>
                            {member.pendingInviteCode}
                          </p>
                          {member.pendingInviteExpiresAt ? (
                            <p className={styles.inviteMeta}>
                              {inviteExpired ? "Expiré le" : "Expire le"}{" "}
                              {member.pendingInviteExpiresAt.toLocaleDateString(
                                "fr-FR",
                              )}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <p className={styles.centeredNote}>
                          Aucune invitation active
                        </p>
                      )}
                    </div>
                    <div className={styles.accessActions}>
                      {member.pendingInviteCode ? (
                        <div className={styles.inviteActions}>
                          <button
                            type="button"
                            className={`${dialogStyles.buttonSecondary} ${styles.inviteAction}`}
                            disabled={panelBusy}
                            onClick={() => void onExtendInvite()}
                          >
                            Prolonger
                          </button>
                          <button
                            type="button"
                            className={`${dialogStyles.buttonSecondary} ${styles.inviteAction}`}
                            disabled={panelBusy}
                            onClick={() => void onRegenerateInvite()}
                          >
                            Nouveau code
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={dialogStyles.buttonSecondary}
                          disabled={panelBusy}
                          onClick={() => void onRegenerateInvite()}
                        >
                          Créer un code
                        </button>
                      )}
                    </div>
                    <div className={styles.accessFooter}>
                      <div className={styles.primaryActions}>
                        {hasValidInvite ? (
                          <>
                            {canEmailInvite ? (
                              <InviteEmailButton
                                onSend={onEmailInvite}
                                disabled={panelBusy}
                              />
                            ) : null}
                            <button
                              type="button"
                              className={
                                canEmailInvite
                                  ? dialogStyles.buttonSecondary
                                  : dialogStyles.button
                              }
                              onClick={onCopyInvite}
                              disabled={panelBusy}
                            >
                              Copier l’invitation
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={dialogStyles.button}
                            disabled={panelBusy}
                            onClick={() => void onRegenerateInvite()}
                          >
                            Générer nouveau code
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {showAdminSection ? (
          <section className={styles.section} data-tone="green">
            <h3 className={styles.sectionTitle}>Admin</h3>
            <div className={styles.sectionBody}>
              <div className={styles.gridTwo}>
                {canEditLicense ? (
                  <form className={styles.block} onSubmit={handleLicenseSubmit}>
                    <label
                      className={styles.blockLabel}
                      htmlFor="member-license"
                    >
                      Numéro de licence
                    </label>
                    <div className={styles.row}>
                      <input
                        id="member-license"
                        className={styles.input}
                        value={license}
                        onChange={(event) => setLicense(event.target.value)}
                        placeholder="Ex. LIC-12345"
                        disabled={panelBusy}
                      />
                      <button
                        type="submit"
                        className={`${dialogStyles.buttonSecondary} ${styles.rowActionCompact}`}
                        disabled={busy || license.trim() === member.license}
                      >
                        OK
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className={styles.block}>
                    <p className={styles.blockLabel}>Numéro de licence</p>
                    <p className={styles.centeredNote}>
                      {member.license || "—"}
                    </p>
                  </div>
                )}

                {canEditRights ? (
                  <div className={styles.block}>
                    <p className={styles.blockLabel}>
                      {permissionsCopy.sectionTitle}
                    </p>
                    <MemberPermissionsEditor
                      permissions={member.permissions}
                      isTeamCoach={isTeamCoach}
                      coachedTeamNames={coachedTeamNames}
                      coachPermissions={activeClub?.coachPermissions}
                      busy={panelBusy}
                      onSave={onChangePermissions}
                    />
                  </div>
                ) : (
                  <div className={styles.block}>
                    <p className={styles.blockLabel}>
                      {permissionsCopy.sectionTitle}
                    </p>
                    <p className={styles.centeredNote}>
                      {permissionsCopy.rightsSummary({
                        isAdmin: isAdminMember(member),
                        permissionCount: member.permissions.length,
                        isTeamCoach,
                      })}
                    </p>
                    {isOwnProfile ? (
                      <p className={styles.centeredNote}>
                        {permissionsCopy.ownRightsReadonly}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {showDangerSection ? (
          <section className={styles.section} data-tone="danger">
            <h3 className={styles.sectionTitle}>Zone sensible</h3>
            <div className={styles.sectionBody}>
              {canRemoveMember ? (
                confirmRemove ? (
                  <div className={styles.dangerRow}>
                    <p className={styles.centeredNote}>
                      Confirmer la suppression de {member.displayName} ?
                      {member.hasLinkedAccount
                        ? " Cette personne perdra l’accès au chat et à l’historique."
                        : " L’invitation en attente sera annulée."}
                    </p>
                    <button
                      type="button"
                      className={dialogStyles.buttonDanger}
                      disabled={panelBusy}
                      onClick={() => void onRemove()}
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      className={dialogStyles.buttonSecondary}
                      disabled={panelBusy}
                      onClick={() => setConfirmRemove(false)}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={dialogStyles.buttonDanger}
                    disabled={panelBusy}
                    onClick={() => setConfirmRemove(true)}
                  >
                    {member.hasLinkedAccount
                      ? "Supprimer le membre"
                      : "Supprimer l’invitation"}
                  </button>
                )
              ) : (
                <p className={styles.centeredNote}>
                  Un administrateur déjà inscrit ne peut pas être supprimé depuis
                  cette fiche.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className={dialogStyles.error} role="alert">
            {error}
          </p>
        ) : null}
      </FadeScrollArea>
    </div>
  );
}

/** Icône crayon légère. */
function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M227.31 73.37 182.63 28.69a16 16 0 0 0-22.63 0L36.69 152A15.86 15.86 0 0 0 32 163.31V208a16 16 0 0 0 16 16h44.69a15.86 15.86 0 0 0 11.31-4.69l123.32-123.31a16 16 0 0 0 0-22.63ZM51.31 160 136 75.31 152.69 92 68 176.69ZM48 179.31 76.69 208H48Zm48 25.38L79.31 188 164 103.31 180.69 120Zm96-96L147.31 64l24-24L216 84.69Z" />
    </svg>
  );
}

/** Icône pouce levé. */
function ThumbUpIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M234 80.12A24 24 0 0 0 216 72h-56V56a40 40 0 0 0-40-40 8 8 0 0 0-7.16 4.42L75.06 96H32a16 16 0 0 0-16 16v88a16 16 0 0 0 16 16h172a24 24 0 0 0 23.82-21l12-96A24 24 0 0 0 234 80.12ZM32 112h40v88H32Zm183.94-15-12 96a8 8 0 0 1-7.94 7H88v-95.21l36.71-73.43A24 24 0 0 1 144 56v24a8 8 0 0 0 8 8h64a8 8 0 0 1 7.94 9Z" />
    </svg>
  );
}

/** Icône croix. */
function CrossIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" />
    </svg>
  );
}
