"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { SettingsAccordion } from "@/components/settings/SettingsAccordion";
import { useToast } from "@/components/ToastProvider";
import { validatePassword, PASSWORD_POLICY_HINT } from "@/lib/auth/passwordPolicy";
import {
  authProviderLabels,
  changeUserEmail,
  changeUserPassword,
  deleteUserAccount,
  hasPasswordProvider,
} from "@/lib/firebase/accountService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  uploadImageAtPath,
  userAvatarStoragePath,
} from "@/lib/firebase/storage";
import { updateUserAvatarUrl } from "@/lib/firebase/userService";
import panelStyles from "@/components/dashboard/DashboardPanel.module.css";
import shared from "@/components/settings/settingsShared.module.css";

/** Section compte partagée (bureau + famille). */
export function AccountSettingsSection() {
  const { user, profile, activeClub, logout, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [emailDraft, setEmailDraft] = useState(profile?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmailDraft(profile?.email ?? "");
  }, [profile?.email]);

  const providers = useMemo(
    () => (user ? authProviderLabels(user) : []),
    [user],
  );
  const passwordAccount = user ? hasPasswordProvider(user) : false;
  const avatarUrl = profile?.avatarUrl ?? null;
  const initials =
    (profile?.displayName ?? "U")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  async function handleAvatarChange(file: File | null) {
    if (!user || !file) return;
    setBusy("avatar");
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const contentType = file.type.startsWith("image/")
        ? file.type
        : "image/jpeg";
      const url = await uploadImageAtPath({
        path: userAvatarStoragePath(user.uid),
        bytes,
        contentType,
      });
      await updateUserAvatarUrl({
        uid: user.uid,
        avatarUrl: url,
        syncMemberClubId: activeClub?.id ?? null,
      });
      await refreshProfile();
      showToast("Avatar mis à jour.", "success");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Upload avatar impossible.",
      );
    } finally {
      setBusy(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy("email");
    setError(null);
    try {
      await changeUserEmail({
        user,
        newEmail: emailDraft,
        currentPassword: passwordAccount ? emailPassword : undefined,
      });
      setEmailPassword("");
      await refreshProfile();
      showToast("E-mail mis à jour.", "success");
    } catch (emailError) {
      setError(
        emailError instanceof Error
          ? emailError.message
          : "Changement d’e-mail impossible.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    const policyError = validatePassword(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    setBusy("password");
    setError(null);
    try {
      await changeUserPassword({
        user,
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Mot de passe mis à jour.", "success");
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Changement de mot de passe impossible.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!user || !deleteConfirm) return;
    setBusy("delete");
    setError(null);
    try {
      await deleteUserAccount({
        user,
        currentPassword: passwordAccount ? deletePassword : undefined,
      });
      showToast("Compte supprimé.", "success");
      await logout();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Suppression impossible.",
      );
      setBusy(null);
    }
  }

  return (
    <section className={`${panelStyles.panel} ${shared.group}`} data-tone="blue">
      <header className={shared.groupHeader}>
        <h2 className={shared.groupTitle}>Compte</h2>
        <p className={shared.groupLead}>
          Avatar, e-mail, mot de passe et sécurité de ton compte ViroTeam.
        </p>
      </header>

      <div className={shared.accordionList}>
        <SettingsAccordion
          title="Avatar"
          description="Photo affichée dans le portail et l’app"
          defaultOpen
        >
          <div className={shared.mediaRow}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className={shared.avatarPreview} />
            ) : (
              <span className={shared.avatarFallback} aria-hidden="true">
                {initials}
              </span>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={shared.fileInput}
              disabled={busy !== null}
              onChange={(event) =>
                void handleAvatarChange(event.target.files?.[0] ?? null)
              }
            />
          </div>
          <div className={shared.actions}>
            <button
              type="button"
              className={shared.secondaryButton}
              disabled={busy !== null}
              onClick={() => avatarInputRef.current?.click()}
            >
              {busy === "avatar" ? "Upload…" : "Changer l’avatar"}
            </button>
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          title="Type de connexion"
          description="Moyens d’accès liés à ton compte"
        >
          <ul className={shared.providerList}>
            {providers.map((label) => (
              <li key={label} className={shared.providerChip}>
                {label}
              </li>
            ))}
          </ul>
        </SettingsAccordion>

        <SettingsAccordion
          title="E-mail"
          description="Adresse utilisée pour te connecter"
        >
          <form
            className={shared.fields}
            onSubmit={(e) => void handleEmailSubmit(e)}
          >
            <label className={shared.field}>
              <span className={shared.label}>Nouvel e-mail</span>
              <input
                className={shared.input}
                type="email"
                value={emailDraft}
                required
                disabled={busy !== null}
                onChange={(event) => setEmailDraft(event.target.value)}
              />
            </label>
            {passwordAccount ? (
              <label className={shared.field}>
                <span className={shared.label}>Mot de passe actuel</span>
                <input
                  className={shared.input}
                  type="password"
                  autoComplete="current-password"
                  value={emailPassword}
                  required
                  disabled={busy !== null}
                  onChange={(event) => setEmailPassword(event.target.value)}
                />
              </label>
            ) : (
              <p className={shared.hint}>
                Une fenêtre Google s’ouvrira pour confirmer le changement.
              </p>
            )}
            <div className={shared.actions}>
              <button
                type="submit"
                className={shared.saveButton}
                disabled={
                  busy !== null || emailDraft.trim() === (profile?.email ?? "")
                }
              >
                {busy === "email" ? "Enregistrement…" : "Changer l’e-mail"}
              </button>
            </div>
          </form>
        </SettingsAccordion>

        {passwordAccount ? (
          <SettingsAccordion
            title="Mot de passe"
            description="Modifier le mot de passe du compte"
          >
            <form
              className={shared.fields}
              onSubmit={(e) => void handlePasswordSubmit(e)}
            >
              <label className={shared.field}>
                <span className={shared.label}>Mot de passe actuel</span>
                <input
                  className={shared.input}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  required
                  disabled={busy !== null}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label className={shared.field}>
                <span className={shared.label}>Nouveau mot de passe</span>
                <input
                  className={shared.input}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  required
                  minLength={8}
                  disabled={busy !== null}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </label>
              <p className={shared.hint}>{PASSWORD_POLICY_HINT}</p>
              <label className={shared.field}>
                <span className={shared.label}>Confirmer</span>
                <input
                  className={shared.input}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  required
                  minLength={6}
                  disabled={busy !== null}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </label>
              <div className={shared.actions}>
                <button
                  type="submit"
                  className={shared.saveButton}
                  disabled={busy !== null}
                >
                  {busy === "password"
                    ? "Enregistrement…"
                    : "Changer le mot de passe"}
                </button>
              </div>
            </form>
          </SettingsAccordion>
        ) : null}

        <SettingsAccordion title="Session" description="Quitter le portail">
          <p className={shared.hint}>
            Tu pourras te reconnecter à tout moment avec le même compte.
          </p>
          <div className={shared.actions}>
            <button
              type="button"
              className={shared.secondaryButton}
              disabled={busy !== null}
              onClick={() => void logout()}
            >
              Déconnexion
            </button>
          </div>
        </SettingsAccordion>

        <SettingsAccordion
          title="Supprimer le compte"
          description="Action irréversible"
          tone="danger"
        >
          <p className={shared.hint}>
            Ton compte sera supprimé et tes fiches membre anonymisées (« Membre
            supprimé »). L’historique des clubs est conservé, tes invitations en
            attente sont révoquées.
          </p>
          <label className={shared.checkRow}>
            <input
              type="checkbox"
              checked={deleteConfirm}
              disabled={busy !== null}
              onChange={(event) => setDeleteConfirm(event.target.checked)}
            />
            <span>Je confirme vouloir supprimer mon compte</span>
          </label>
          {passwordAccount ? (
            <label className={shared.field}>
              <span className={shared.label}>Mot de passe actuel</span>
              <input
                className={shared.input}
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                disabled={busy !== null || !deleteConfirm}
                onChange={(event) => setDeletePassword(event.target.value)}
              />
            </label>
          ) : (
            <p className={shared.hint}>
              Une fenêtre Google s’ouvrira pour confirmer la suppression.
            </p>
          )}
          <div className={shared.actions}>
            <button
              type="button"
              className={shared.dangerButton}
              disabled={busy !== null || !deleteConfirm}
              onClick={() => void handleDelete()}
            >
              {busy === "delete" ? "Suppression…" : "Supprimer mon compte"}
            </button>
          </div>
        </SettingsAccordion>
      </div>

      {error ? (
        <p className={shared.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
