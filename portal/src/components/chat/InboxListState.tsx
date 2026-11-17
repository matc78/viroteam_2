"use client";

import styles from "./InboxListState.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type InboxListStateProps = {
  /** Premier chargement de l’inbox en cours (aucune discussion reçue). */
  loading: boolean;
  /** Écoute de l’inbox en erreur. */
  error: boolean;
  onRetry: () => void;
  /** Nombre de discussions avant filtre / après filtre de recherche. */
  totalCount: number;
  filteredCount: number;
  /** Bouton « Nouvelle discussion » dans l’état vide (dock). */
  onCompose?: () => void;
};

/**
 * État de la liste de discussions (dock et page Messages) : erreur avec
 * Réessayer (affichée au-dessus d’une liste partielle), chargement, inbox
 * vide, ou aucun résultat pour la recherche. Rien si la liste a des lignes
 * et qu’il n’y a pas d’erreur.
 */
export function InboxListState({
  loading,
  error,
  onRetry,
  totalCount,
  filteredCount,
  onCompose,
}: InboxListStateProps) {
  if (error) {
    return (
      <div className={styles.block} role="alert">
        <p className={styles.title}>{chatCopy.loadError}</p>
        <button type="button" className={styles.retry} onClick={onRetry}>
          {chatCopy.retry}
        </button>
      </div>
    );
  }
  if (loading && totalCount === 0) {
    return (
      <p className={styles.muted} role="status">
        {chatCopy.loading}
      </p>
    );
  }
  if (totalCount === 0) {
    return (
      <div className={styles.block}>
        <p className={styles.title}>{chatCopy.emptyInbox}</p>
        <p className={styles.hint}>{chatCopy.emptyInboxHint}</p>
        {onCompose ? (
          <button type="button" className={styles.cta} onClick={onCompose}>
            {chatCopy.newConversation}
          </button>
        ) : null}
      </div>
    );
  }
  if (filteredCount === 0) {
    return (
      <p className={styles.muted} role="status">
        {chatCopy.searchNoResults}
      </p>
    );
  }
  return null;
}
