"use client";

import { useState } from "react";
import { AuthLoadingState } from "@/components/auth/AuthLoadingState";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { useToast } from "@/components/ToastProvider";
import {
  deleteUserAccount,
  hasPasswordProvider,
} from "@/lib/firebase/accountService";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { sessionCopy } from "@/lib/copy/sessionCopy";
import shared from "@/components/settings/settingsShared.module.css";

/**
 * Pied de page Paramètres (bureau + famille) : déconnexion et suppression du
 * compte, en liens discrets ; la suppression passe par une modale.
 */
export function AccountExitSection() {
  const { user, profile, logout } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const passwordAccount = user ? hasPasswordProvider(user) : false;

  async function handleLogout() {
    setBusy("logout");
    setError(null);
    try {
      await logout();
      // Loader conservé jusqu’à la redirection vers /login.
    } catch (logoutError) {
      setError(
        logoutError instanceof Error
          ? logoutError.message
          : "Déconnexion impossible.",
      );
      setBusy(null);
    }
  }

  async function handleDelete(currentPassword: string | undefined) {
    if (!user) return;
    setBusy("delete");
    setDeleteError(null);
    try {
      await deleteUserAccount({ user, currentPassword });
      showToast("Compte supprimé.", "success");
      await logout();
      // Loader conservé jusqu’à la redirection (busy reste "delete").
    } catch (failure) {
      setDeleteError(
        failure instanceof Error ? failure.message : "Suppression impossible.",
      );
      setBusy(null);
    }
  }

  return (
    <footer className={shared.exitZone}>
      {busy === "logout" ? (
        <AuthLoadingState message={sessionCopy.loggingOut} />
      ) : null}
      {busy === "delete" && !deleteDialogOpen ? (
        <AuthLoadingState message="Suppression…" />
      ) : null}
      <p className={shared.exitIdentity}>
        {profile?.email ? `Connecté avec ${profile.email}` : null}
      </p>
      <div className={shared.exitActions}>
        <button
          type="button"
          className={shared.linkButton}
          disabled={busy !== null}
          onClick={() => void handleLogout()}
        >
          {sessionCopy.logout}
        </button>
        <button
          type="button"
          className={shared.dangerLink}
          disabled={busy !== null}
          onClick={() => {
            setDeleteError(null);
            setDeleteDialogOpen(true);
          }}
        >
          Supprimer mon compte…
        </button>
      </div>
      {error ? (
        <p className={shared.error} role="alert">
          {error}
        </p>
      ) : null}
      {deleteDialogOpen ? (
        <DeleteAccountDialog
          passwordAccount={passwordAccount}
          busy={busy === "delete"}
          error={deleteError}
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={handleDelete}
        />
      ) : null}
    </footer>
  );
}
