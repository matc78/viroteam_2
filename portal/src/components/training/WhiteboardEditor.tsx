"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  BOARD_WIDTH,
  boardHeight,
  WhiteboardSvg,
} from "@/components/training/WhiteboardSvg";
import {
  arrowAt,
  clampPoint,
  dragArrow,
  MAX_STROKES,
  newToken,
  simplifyPoints,
  type ArrowPart,
  type WhiteboardCourt,
  type WhiteboardData,
  type WhiteboardInk,
  type WhiteboardPoint,
  type WhiteboardStroke,
  type WhiteboardTokenKind,
} from "@/lib/training/whiteboard";
import styles from "./WhiteboardEditor.module.css";

type Tool = "pen" | "arrow" | "move";

const TOOLS: ReadonlyArray<{ value: Tool; label: string; key: string }> = [
  { value: "pen", label: "Crayon", key: "C" },
  { value: "arrow", label: "Flèche", key: "F" },
  { value: "move", label: "Déplacer", key: "D" },
];

const INKS: ReadonlyArray<{ value: WhiteboardInk; label: string }> = [
  { value: "accent", label: "Encre bleue" },
  { value: "red", label: "Encre rouge" },
  { value: "dark", label: "Encre sombre" },
];

const TOKENS: ReadonlyArray<{ value: WhiteboardTokenKind; label: string }> = [
  { value: "player", label: "Joueur" },
  { value: "opponent", label: "Adversaire" },
  { value: "ball", label: "Ballon" },
];

const COURTS: ReadonlyArray<{ value: WhiteboardCourt; label: string }> = [
  { value: "full", label: "Terrain entier" },
  { value: "half", label: "Demi-terrain" },
  { value: "blank", label: "Tableau blanc" },
];

/** Rayon de prise d’un jeton (relatif à la largeur), comme l’app. */
const TOKEN_HIT_RATIO = 0.045 * 1.6;
/** Rayon de prise d’une extrémité de flèche (relatif à la largeur). */
const ARROW_HANDLE_RATIO = 0.03;
/** Distance de prise du trait d’une flèche (relative à la largeur). */
const ARROW_BODY_RATIO = 0.018;

/** Objet en cours de déplacement : un jeton, ou une flèche (ou une extrémité). */
type Drag =
  | { kind: "token"; index: number }
  | {
      kind: "arrow";
      index: number;
      part: ArrowPart;
      origin: WhiteboardPoint;
      original: WhiteboardStroke;
    };

type WhiteboardEditorProps = {
  board: WhiteboardData;
  onChange: (board: WhiteboardData) => void;
  disabled?: boolean;
  /** Bloc affiché à droite du schéma sur grand écran, aligné sur son haut. */
  aside?: ReactNode;
};

/**
 * Éditeur grand format d’un schéma : crayon, flèche, déplacement des
 * jetons et des flèches (ou d’une extrémité de flèche), trois encres, joueurs / adversaires / ballon, annuler, tout
 * effacer et choix du fond. Double-clic sur un joueur ou un adversaire :
 * changer son numéro. Raccourcis : C, F, D, Ctrl+Z.
 */
export function WhiteboardEditor({
  board,
  onChange,
  disabled = false,
  aside,
}: WhiteboardEditorProps) {
  const [tool, setTool] = useState<Tool>("pen");
  const [ink, setInk] = useState<WhiteboardInk>("accent");
  const [history, setHistory] = useState<WhiteboardData[]>([]);
  const [pending, setPending] = useState<WhiteboardStroke | null>(null);
  const [moving, setMoving] = useState<WhiteboardData | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<Drag | null>(null);
  /** Flèche sélectionnée (poignées sur ses extrémités, Suppr l’efface). */
  const [selectedArrow, setSelectedArrow] = useState<number | null>(null);
  /** Jeton dont on modifie le numéro (double-clic). */
  const [labelEdit, setLabelEdit] = useState<{
    index: number;
    value: string;
  } | null>(null);

  const shown = moving ?? board;

  function apply(next: WhiteboardData) {
    setHistory((current) => [...current.slice(-49), board]);
    onChange(next);
  }

  function pointFromEvent(event: PointerEvent<SVGSVGElement>): WhiteboardPoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampPoint({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  function tokenAt(point: WhiteboardPoint): number | null {
    const width = BOARD_WIDTH;
    const height = boardHeight(board);
    const hit = width * TOKEN_HIT_RATIO;
    for (let i = board.tokens.length - 1; i >= 0; i -= 1) {
      const token = board.tokens[i]!.position;
      const dx = (token.x - point.x) * width;
      const dy = (token.y - point.y) * height;
      if (dx * dx + dy * dy <= hit * hit) return i;
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    const index = tokenAt(point);
    // Jetons et flèches se déplacent avec tous les outils (comme l’app en
    // mode Déplacer) ; une extrémité de flèche se déplace seule.
    if (index !== null) {
      drag.current = { kind: "token", index };
      setSelectedArrow(null);
      setMoving(board);
      return;
    }
    const width = BOARD_WIDTH;
    const arrow = arrowAt(
      board,
      point,
      { width, height: boardHeight(board) },
      width * ARROW_HANDLE_RATIO,
      width * ARROW_BODY_RATIO,
    );
    if (arrow) {
      drag.current = {
        kind: "arrow",
        index: arrow.index,
        part: arrow.part,
        origin: point,
        original: board.strokes[arrow.index]!,
      };
      setSelectedArrow(arrow.index);
      setMoving(board);
      return;
    }
    setSelectedArrow(null);
    if (tool === "move") return;
    if (board.strokes.length >= MAX_STROKES) {
      setNotice("Schéma plein : efface un élément pour continuer.");
      return;
    }
    setPending({
      kind: tool === "arrow" ? "arrow" : "pen",
      ink,
      points: [point],
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const point = pointFromEvent(event);
    const current = drag.current;
    if (current && moving) {
      if (current.kind === "token") {
        const tokens = [...moving.tokens];
        tokens[current.index] = { ...tokens[current.index]!, position: point };
        setMoving({ ...moving, tokens });
      } else {
        const strokes = [...moving.strokes];
        strokes[current.index] = dragArrow(
          current.original,
          current.part,
          current.origin,
          point,
        );
        setMoving({ ...moving, strokes });
      }
      return;
    }
    if (!pending) return;
    setPending({
      ...pending,
      points:
        pending.kind === "arrow"
          ? [pending.points[0]!, point]
          : [...pending.points, point],
    });
  }

  function handlePointerUp() {
    // Un simple clic sur un objet ne crée pas d’étape d’annulation.
    if (drag.current && moving && moving !== board) {
      apply(moving);
    }
    drag.current = null;
    setMoving(null);
    if (pending && pending.points.length >= 2) {
      apply({
        ...board,
        strokes: [
          ...board.strokes,
          { ...pending, points: simplifyPoints(pending.points) },
        ],
      });
    }
    setPending(null);
  }

  /** Double-clic sur un joueur ou un adversaire : édition de son numéro. */
  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    const svg = svgRef.current;
    if (disabled || !svg) return;
    const rect = svg.getBoundingClientRect();
    const index = tokenAt(
      clampPoint({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      }),
    );
    const token = index !== null ? board.tokens[index] : undefined;
    if (index === null || !token || token.kind === "ball") return;
    event.preventDefault();
    setLabelEdit({ index, value: token.label });
  }

  function commitLabel() {
    if (!labelEdit) return;
    const token = board.tokens[labelEdit.index];
    const value = labelEdit.value.trim();
    setLabelEdit(null);
    if (!token || value === token.label) return;
    const tokens = [...board.tokens];
    tokens[labelEdit.index] = { ...token, label: value };
    apply({ ...board, tokens });
  }

  const editedToken = labelEdit ? board.tokens[labelEdit.index] : undefined;

  function addToken(kind: WhiteboardTokenKind) {
    const token = newToken(board, kind);
    if (!token) {
      setNotice("Schéma plein : efface un élément pour continuer.");
      return;
    }
    setNotice(null);
    apply({ ...board, tokens: [...board.tokens, token] });
    setTool("move");
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    onChange(previous);
  }

  // Flèche sélectionnée encore valide (une annulation a pu la retirer).
  const activeArrow =
    selectedArrow !== null && shown.strokes[selectedArrow]?.kind === "arrow"
      ? selectedArrow
      : null;

  function deleteSelectedArrow() {
    if (activeArrow === null) return;
    apply({
      ...board,
      strokes: board.strokes.filter((_, index) => index !== activeArrow),
    });
    setSelectedArrow(null);
  }

  // Raccourcis valables n’importe où sur la page (hors champ texte, qui
  // garde son comportement natif) : Ctrl+Z (Cmd+Z) = bouton Annuler,
  // Suppr / Retour arrière = effacer la flèche sélectionnée.
  const keyActions = useRef({ undo, deleteSelectedArrow });
  useEffect(() => {
    keyActions.current = { undo, deleteSelectedArrow };
  });
  useEffect(() => {
    if (disabled) return;
    function handleWindowKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        keyActions.current.deleteSelectedArrow();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) {
        return;
      }
      if (event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      keyActions.current.undo();
    }
    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, [disabled]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select")) return;
    const match = TOOLS.find(
      (item) => item.key.toLowerCase() === event.key.toLowerCase(),
    );
    if (match && !event.ctrlKey && !event.metaKey && !event.altKey) {
      setTool(match.value);
    }
  }

  return (
    <div
      className={styles.root}
      data-with-aside={aside ? "true" : undefined}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.head}>
        <div
          className={styles.toolbar}
          role="toolbar"
          aria-label="Outils du schéma"
        >
          <div className={styles.group} role="group" aria-label="Outil">
            {TOOLS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={styles.tool}
                aria-pressed={tool === item.value}
                title={`${item.label} (${item.key})`}
                disabled={disabled}
                onClick={() => setTool(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.group} role="group" aria-label="Encre">
            {INKS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={styles.ink}
                data-ink={item.value}
                aria-pressed={ink === item.value}
                aria-label={item.label}
                title={item.label}
                disabled={disabled}
                onClick={() => {
                  setInk(item.value);
                  if (tool === "move") setTool("pen");
                }}
              />
            ))}
          </div>
          <div className={styles.group} role="group" aria-label="Ajouter">
            {TOKENS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={styles.tool}
                data-token={item.value}
                disabled={disabled}
                onClick={() => addToken(item.value)}
              >
                + {item.label}
              </button>
            ))}
          </div>
          <div className={styles.group}>
            {/* Pendant la confirmation, seuls Effacer / Garder restent
                (Annuler y ferait doublon avec Garder). */}
            {!confirmClear ? (
              <button
                type="button"
                className={styles.tool}
                disabled={disabled || history.length === 0}
                title="Annuler (Ctrl+Z)"
                onClick={undo}
              >
                Annuler
              </button>
            ) : null}
            {confirmClear ? (
              <span className={styles.confirm}>
                <span className={styles.confirmLabel}>Tout effacer ?</span>
                <button
                  type="button"
                  className={styles.danger}
                  onClick={() => {
                    apply({ ...board, strokes: [], tokens: [] });
                    setConfirmClear(false);
                  }}
                >
                  Effacer
                </button>
                <button
                  type="button"
                  className={styles.tool}
                  onClick={() => setConfirmClear(false)}
                >
                  Garder
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.tool}
                disabled={
                  disabled ||
                  (board.strokes.length === 0 && board.tokens.length === 0)
                }
                onClick={() => setConfirmClear(true)}
              >
                Tout effacer
              </button>
            )}
          </div>
          <label className={styles.courtSelect}>
            <span className="sr-only">Fond du schéma</span>
            <select
              value={board.court}
              disabled={disabled}
              onChange={(event) =>
                apply({
                  ...board,
                  court: event.target.value as WhiteboardCourt,
                })
              }
            >
              {COURTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {notice ? (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        ) : null}
      </div>

      <div
        className={styles.canvas}
        data-court={board.court}
        onDoubleClick={handleDoubleClick}
      >
        <WhiteboardSvg
          board={shown}
          pending={pending}
          label="Schéma d’exercice"
          svgRef={svgRef}
          selectedStroke={activeArrow}
          cursor={disabled ? "default" : tool === "move" ? "grab" : "crosshair"}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        {labelEdit && editedToken ? (
          <input
            className={styles.labelInput}
            style={{
              left: `${editedToken.position.x * 100}%`,
              top: `${editedToken.position.y * 100}%`,
            }}
            value={labelEdit.value}
            maxLength={2}
            autoFocus
            aria-label={
              editedToken.kind === "opponent"
                ? "Numéro de l’adversaire"
                : "Numéro du joueur"
            }
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setLabelEdit({ ...labelEdit, value: event.target.value })
            }
            onBlur={commitLabel}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitLabel();
              if (event.key === "Escape") setLabelEdit(null);
            }}
          />
        ) : null}
      </div>
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </div>
  );
}
