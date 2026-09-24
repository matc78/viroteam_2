"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat } from "@/lib/chat/ChatProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { createCategoryChannel } from "@/lib/firebase/chatService";
import { MemberRoles } from "@/lib/firebase/constants";
import styles from "./CreateCategoryChannelDialog.module.css";

/**
 * Dialog admin : crée un canal catégorie (callable `createCategoryChannel`).
 */
export function CreateCategoryChannelDialog() {
  const { user, bureauClubs } = useAuth();
  const { closeCategoryChannel, openThread, roleForClub } = useChat();

  const adminClubs = useMemo(
    () =>
      bureauClubs.filter(
        (club) => roleForClub(club.id) === MemberRoles.admin,
      ),
    [bureauClubs, roleForClub],
  );

  const [clubId, setClubId] = useState(adminClubs[0]?.id ?? "");
  const [categoryKey, setCategoryKey] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clubId && adminClubs[0]) setClubId(adminClubs[0].id);
  }, [adminClubs, clubId]);

  async function handleSubmit() {
    const trimmedKey = categoryKey.trim();
    if (!clubId || !trimmedKey || !user) return;
    setBusy(true);
    setError(null);
    try {
      const conversationId = await createCategoryChannel({
        clubId,
        categoryKey: trimmedKey,
        title: title.trim() || trimmedKey,
      });
      closeCategoryChannel();
      openThread({ clubId, conversationId });
    } catch (submitError) {
      console.error("[chat] createCategoryChannel failed", submitError);
      setError("Création du canal impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (adminClubs.length === 0) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={closeCategoryChannel}
      role="presentation"
    >
      <div
        className={styles.panel}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Canal catégorie"
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Canal catégorie</h2>
            <p className={styles.hint}>
              Canal en lecture seule (seuls les admins écrivent).
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            aria-label="Fermer"
            onClick={closeCategoryChannel}
          >
            ×
          </button>
        </div>

        {adminClubs.length > 1 ? (
          <div className={styles.field}>
            <label htmlFor="category-club">Club</label>
            <select
              id="category-club"
              value={clubId}
              onChange={(event) => setClubId(event.target.value)}
              disabled={busy}
            >
              {adminClubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.field}>
          <label htmlFor="category-key">Catégorie (ex. U15)</label>
          <input
            id="category-key"
            value={categoryKey}
            onChange={(event) => setCategoryKey(event.target.value)}
            placeholder="U15"
            disabled={busy}
            autoFocus
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="category-title">Titre affiché</label>
          <input
            id="category-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Parents U15"
            disabled={busy}
          />
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={closeCategoryChannel}
            disabled={busy}
          >
            Annuler
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            disabled={busy || !categoryKey.trim()}
            onClick={() => void handleSubmit()}
          >
            {busy ? "Création…" : "Créer le canal"}
          </button>
        </div>
      </div>
    </div>
  );
}
