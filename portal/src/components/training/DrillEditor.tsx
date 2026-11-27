"use client";

import { useState, type ReactNode } from "react";
import { WhiteboardEditor } from "@/components/training/WhiteboardEditor";
import { WhiteboardSvg } from "@/components/training/WhiteboardSvg";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { MAX_BOARDS, type TrainingDrill } from "@/lib/training/trainingPlan";
import { EMPTY_BOARD } from "@/lib/training/whiteboard";
import styles from "./DrillEditor.module.css";

type DrillEditorProps = {
  drill: TrainingDrill;
  /** Rang de l’exercice dans la séance (1 = premier), pour « Exo N ». */
  position: number;
  onChange: (drill: TrainingDrill) => void;
  /** Lecture seule (préparation d’un collègue). */
  readOnly?: boolean;
  /** Actions de l’exercice (suppression), à droite du titre. */
  actions?: ReactNode;
};

/**
 * Fiche d’un exercice : titre et durée sur une ligne, puis le schéma au
 * centre (galerie de jusqu’à 6 schémas au-dessus du grand éditeur) et les
 * consignes à côté sur grand écran.
 */
export function DrillEditor({
  drill,
  position,
  onChange,
  readOnly = false,
  actions,
}: DrillEditorProps) {
  const [boardIndex, setBoardIndex] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const currentIndex = Math.min(
    boardIndex,
    Math.max(0, drill.boards.length - 1),
  );
  const board = drill.boards[currentIndex] ?? null;
  const canAddBoard = !readOnly && drill.boards.length < MAX_BOARDS;

  function update(patch: Partial<TrainingDrill>) {
    onChange({ ...drill, ...patch });
  }

  function addBoard() {
    if (drill.boards.length >= MAX_BOARDS) return;
    // Nouveau schéma sur le même fond que le schéma affiché.
    update({
      boards: [
        ...drill.boards,
        { ...EMPTY_BOARD, court: board?.court ?? "full" },
      ],
    });
    setBoardIndex(drill.boards.length);
    setConfirmRemove(false);
  }

  function removeBoard() {
    update({
      boards: drill.boards.filter((_, index) => index !== currentIndex),
    });
    setBoardIndex(Math.max(0, currentIndex - 1));
    setConfirmRemove(false);
  }

  const boardBar =
    drill.boards.length > 0 ? (
      <div className={styles.boardBar}>
        <ul className={styles.gallery}>
          {drill.boards.map((item, index) => (
            <li key={index}>
              <button
                type="button"
                className={styles.thumb}
                aria-pressed={index === currentIndex}
                aria-label={`Schéma ${index + 1}`}
                onClick={() => {
                  setBoardIndex(index);
                  setConfirmRemove(false);
                }}
              >
                <WhiteboardSvg board={item} label={`Schéma ${index + 1}`} />
              </button>
            </li>
          ))}
          {canAddBoard ? (
            <li>
              <button
                type="button"
                className={styles.addThumb}
                aria-label="Ajouter un schéma"
                title={`Ajouter un schéma (${drill.boards.length}/${MAX_BOARDS})`}
                onClick={addBoard}
              >
                <Icon name="plus" size={18} />
              </button>
            </li>
          ) : null}
        </ul>
        {!readOnly ? (
          <span className={styles.boardActions}>
            {confirmRemove ? (
              <>
                <Button size="sm" variant="danger" onClick={removeBoard}>
                  Supprimer le schéma {currentIndex + 1}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRemove(false)}
                >
                  Garder
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmRemove(true)}
              >
                Supprimer ce schéma
              </Button>
            )}
          </span>
        ) : null}
      </div>
    ) : null;

  const instructionsField = (
    <label className={styles.instructions}>
      <span className={styles.label}>Consignes</span>
      <textarea
        className={styles.textarea}
        value={drill.instructions}
        rows={5}
        placeholder="Organisation, rotations, points clés…"
        readOnly={readOnly}
        onChange={(event) => update({ instructions: event.target.value })}
      />
    </label>
  );

  return (
    <div className={styles.root}>
      <div className={styles.topRow}>
        <div className={styles.titleGroup}>
          <span className={styles.position} aria-hidden="true">
            {position}
          </span>
          <input
            className={styles.titleInput}
            value={drill.title}
            aria-label="Titre de l’exercice"
            placeholder={`Exo ${position}`}
            maxLength={120}
            readOnly={readOnly}
            onChange={(event) => update({ title: event.target.value })}
          />
        </div>
        {boardBar}
        <div className={styles.endGroup}>
          <label className={styles.duration}>
            <input
              className={styles.durationInput}
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              placeholder="–"
              aria-label="Durée en minutes"
              value={drill.durationMin ?? ""}
              readOnly={readOnly}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                update({
                  durationMin:
                    Number.isFinite(value) && value > 0
                      ? Math.min(value, 600)
                      : null,
                });
              }}
            />
            <span aria-hidden="true">min</span>
          </label>
          {actions}
        </div>
      </div>

      <section className={styles.boardArea} aria-label="Schémas de l’exercice">
        {board && !readOnly ? (
          // Consignes à droite du tableau, alignées sur le haut du schéma.
          <WhiteboardEditor
            key={`${drill.id}:${currentIndex}`}
            board={board}
            aside={instructionsField}
            onChange={(next) =>
              update({
                boards: drill.boards.map((item, index) =>
                  index === currentIndex ? next : item,
                ),
              })
            }
          />
        ) : (
          <div className={styles.stage}>
            {board ? (
              <div className={styles.readOnlyBoard} data-court={board.court}>
                <WhiteboardSvg
                  board={board}
                  label={`Schéma ${currentIndex + 1}`}
                />
              </div>
            ) : readOnly ? (
              <p className={styles.muted}>Pas de schéma pour cet exercice.</p>
            ) : (
              <button
                type="button"
                className={styles.emptyBoard}
                onClick={addBoard}
              >
                <Icon name="plus" size={22} />
                <span>Dessiner un schéma</span>
              </button>
            )}
            {instructionsField}
          </div>
        )}
      </section>
    </div>
  );
}
