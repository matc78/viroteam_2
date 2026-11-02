"use client";

import { FormEvent, useState } from "react";
import type { User } from "firebase/auth";
import { useToast } from "@/components/ToastProvider";
import { PASSWORD_POLICY_HINT, validatePassword } from "@/lib/auth/passwordPolicy";
import {
  hasAppleProvider,
  hasGoogleProvider,
  hasPasswordProvider,
  linkAppleProvider,
  linkGoogleProvider,
  linkPasswordProvider,
} from "@/lib/firebase/accountService";
import shared from "@/components/settings/settingsShared.module.css";

type SignInMethodsListProps = {
  user: User;
  /** Désactive les actions pendant une autre opération du compte. */
  disabled: boolean;
  /** Appelé après une liaison réussie (les providers du `user` ont changé). */
  onLinked: () => void;
};

type LinkBusy = "google" | "apple" | "password" | null;

/**
 * Moyens de connexion du compte : statut lié / non lié, et liaison de
 * Google, Apple ou d’un mot de passe (comptes créés via Google / Apple).
 */
export function SignInMethodsList({
  user,
  disabled,
  onLinked,
}: SignInMethodsListProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState<LinkBusy>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const passwordLinked = hasPasswordProvider(user);
  const googleLinked = hasGoogleProvider(user);
  const appleLinked = hasAppleProvider(user);
  const actionsDisabled = disabled || busy !== null;

  async function runLink(
    kind: Exclude<LinkBusy, null>,
    action: () => Promise<void>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(kind);
    setError(null);
    try {
      await action();
      onLinked();
      showToast(successMessage, "success");
      return true;
    } catch (linkError) {
      setError(
        linkError instanceof Error ? linkError.message : "Liaison impossible.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    const policyError = validatePassword(newPassword);
    if (policyError) {
      setError(policyError);
      return;
    }
    const linked = await runLink(
      "password",
      () => linkPasswordProvider({ user, newPassword }),
      "Mot de passe ajouté.",
    );
    if (linked) {
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFormOpen(false);
    }
  }

  return (
    <div className={shared.fields}>
      <ul className={shared.permissionList}>
        <li className={shared.providerRow}>
          <div>
            <p className={shared.providerName}>E-mail et mot de passe</p>
            <p className={shared.providerStatus}>
              {passwordLinked
                ? user.email
                : `Te connecter avec ${user.email ?? "ton e-mail"} et un mot de passe`}
            </p>
          </div>
          {passwordLinked ? (
            <span className={shared.providerLinked}>Lié</span>
          ) : (
            <button
              type="button"
              className={shared.secondaryButton}
              disabled={actionsDisabled || passwordFormOpen || !user.email}
              onClick={() => {
                setError(null);
                setPasswordFormOpen(true);
              }}
            >
              Ajouter un mot de passe
            </button>
          )}
        </li>
        <li className={shared.providerRow}>
          <div>
            <p className={shared.providerName}>Google</p>
            <p className={shared.providerStatus}>
              {googleLinked
                ? "Connexion en un clic avec ton compte Google"
                : "Te connecter avec ton compte Google"}
            </p>
          </div>
          {googleLinked ? (
            <span className={shared.providerLinked}>Lié</span>
          ) : (
            <button
              type="button"
              className={shared.secondaryButton}
              disabled={actionsDisabled}
              onClick={() =>
                void runLink(
                  "google",
                  () => linkGoogleProvider(user),
                  "Compte Google lié.",
                )
              }
            >
              {busy === "google" ? "Liaison…" : "Lier Google"}
            </button>
          )}
        </li>
        <li className={shared.providerRow}>
          <div>
            <p className={shared.providerName}>Apple</p>
            <p className={shared.providerStatus}>
              {appleLinked
                ? "Connexion avec ton identifiant Apple"
                : "Te connecter avec ton identifiant Apple (iPhone)"}
            </p>
          </div>
          {appleLinked ? (
            <span className={shared.providerLinked}>Lié</span>
          ) : (
            <button
              type="button"
              className={shared.secondaryButton}
              disabled={actionsDisabled}
              onClick={() =>
                void runLink(
                  "apple",
                  () => linkAppleProvider(user),
                  "Identifiant Apple lié.",
                )
              }
            >
              {busy === "apple" ? "Liaison…" : "Lier Apple"}
            </button>
          )}
        </li>
      </ul>

      {passwordFormOpen && !passwordLinked ? (
        <form
          className={shared.fields}
          onSubmit={(event) => void handlePasswordSubmit(event)}
        >
          <label className={shared.field}>
            <span className={shared.label}>Nouveau mot de passe</span>
            <input
              className={shared.input}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              required
              minLength={8}
              disabled={actionsDisabled}
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
              minLength={8}
              disabled={actionsDisabled}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <div className={shared.actions}>
            <button
              type="button"
              className={shared.resetButton}
              disabled={actionsDisabled}
              onClick={() => {
                setPasswordFormOpen(false);
                setNewPassword("");
                setConfirmPassword("");
                setError(null);
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={shared.saveButton}
              disabled={actionsDisabled}
            >
              {busy === "password" ? "Enregistrement…" : "Ajouter le mot de passe"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className={shared.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
