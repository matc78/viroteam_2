import { useId, type PointerEventHandler, type Ref } from "react";
import {
  whiteboardAspectRatio,
  type WhiteboardData,
  type WhiteboardStroke,
  type WhiteboardToken,
} from "@/lib/training/whiteboard";
import styles from "./Whiteboard.module.css";

/** Largeur du repère SVG ; la hauteur suit les proportions du fond. */
export const BOARD_WIDTH = 1000;

/** Rayon d’un jeton, relatif à la largeur (comme l’app). */
const TOKEN_RADIUS_RATIO = 0.045;

/** Hauteur du repère SVG pour [board]. */
export function boardHeight(board: WhiteboardData): number {
  return BOARD_WIDTH / whiteboardAspectRatio(board.court);
}

type WhiteboardSvgProps = {
  board: WhiteboardData;
  /** Trait en cours de tracé (pas encore dans [board]). */
  pending?: WhiteboardStroke | null;
  /** Libellé accessible (image). */
  label: string;
  className?: string;
  svgRef?: Ref<SVGSVGElement>;
  onPointerDown?: PointerEventHandler<SVGSVGElement>;
  onPointerMove?: PointerEventHandler<SVGSVGElement>;
  onPointerUp?: PointerEventHandler<SVGSVGElement>;
  /** Curseur selon l’outil (`crosshair`, `grab`…). */
  cursor?: string;
  /** Flèche sélectionnée : poignées sur ses extrémités. */
  selectedStroke?: number | null;
};

/**
 * Rendu SVG d’un schéma d’exercice (terrain de volley, traits, jetons),
 * même géométrie que `WhiteboardPainter` de l’app. Sert à la miniature et
 * à l’éditeur (gestionnaires de pointeur fournis).
 */
export function WhiteboardSvg({
  board,
  pending = null,
  label,
  className,
  svgRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cursor,
  selectedStroke = null,
}: WhiteboardSvgProps) {
  const selected =
    selectedStroke !== null ? board.strokes[selectedStroke] : undefined;
  const width = BOARD_WIDTH;
  const height = boardHeight(board);
  // Ids de marqueurs propres à ce SVG (plusieurs miniatures par page).
  const markerPrefix = `wb${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg
      ref={svgRef}
      className={[styles.svg, className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      style={cursor ? { cursor } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <defs>
        <marker
          id={`${markerPrefix}-accent`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
          className={styles.inkAccentFill}
        >
          <path d="M0 0 10 5 0 10Z" />
        </marker>
        <marker
          id={`${markerPrefix}-red`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
          className={styles.inkRedFill}
        >
          <path d="M0 0 10 5 0 10Z" />
        </marker>
        <marker
          id={`${markerPrefix}-dark`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
          className={styles.inkDarkFill}
        >
          <path d="M0 0 10 5 0 10Z" />
        </marker>
      </defs>
      <Court board={board} width={width} height={height} />
      {board.strokes.map((stroke, index) => (
        <Stroke
          key={index}
          stroke={stroke}
          width={width}
          height={height}
          markerPrefix={markerPrefix}
        />
      ))}
      {pending ? (
        <Stroke
          stroke={pending}
          width={width}
          height={height}
          markerPrefix={markerPrefix}
        />
      ) : null}
      {board.tokens.map((token, index) => (
        <Token key={index} token={token} width={width} height={height} />
      ))}
      {selected && selected.points.length >= 2
        ? [
            selected.points[0]!,
            selected.points[selected.points.length - 1]!,
          ].map((point, index) => (
            <circle
              key={index}
              className={styles.handle}
              cx={point.x * width}
              cy={point.y * height}
              r={width * 0.014}
              strokeWidth={width * 0.004}
            />
          ))
        : null}
    </svg>
  );
}

function Court({
  board,
  width,
  height,
}: {
  board: WhiteboardData;
  width: number;
  height: number;
}) {
  if (board.court === "blank") {
    return <rect className={styles.blank} width={width} height={height} />;
  }
  const marginX = width * 0.1;
  const marginY = height * 0.06;
  const top = board.court === "half" ? height * 0.08 : marginY;
  const left = marginX;
  const right = width - marginX;
  const bottom = height - marginY;
  const courtHeight = bottom - top;
  const lineWidth = Math.max(1, width * 0.006);
  const netWidth = Math.max(2, width * 0.012);
  const netExtra = marginX * 0.4;

  const lines =
    board.court === "full"
      ? (() => {
          const netY = top + courtHeight / 2;
          const attack = (courtHeight * 3) / 18;
          return {
            attack: [netY - attack, netY + attack],
            netY,
          };
        })()
      : { attack: [top + (courtHeight * 3) / 9], netY: top };

  return (
    <g>
      <rect className={styles.floor} width={width} height={height} />
      <rect
        className={styles.court}
        x={left}
        y={top}
        width={right - left}
        height={courtHeight}
        strokeWidth={lineWidth}
      />
      {lines.attack.map((y) => (
        <line
          key={y}
          className={styles.line}
          x1={left}
          x2={right}
          y1={y}
          y2={y}
          strokeWidth={lineWidth}
        />
      ))}
      <line
        className={styles.net}
        x1={left - netExtra}
        x2={right + netExtra}
        y1={lines.netY}
        y2={lines.netY}
        strokeWidth={netWidth}
        strokeLinecap="round"
      />
    </g>
  );
}

const INK_CLASS = {
  accent: styles.inkAccent,
  red: styles.inkRed,
  dark: styles.inkDark,
} as const;

function Stroke({
  stroke,
  width,
  height,
  markerPrefix,
}: {
  stroke: WhiteboardStroke;
  width: number;
  height: number;
  markerPrefix: string;
}) {
  if (stroke.points.length < 2) return null;
  const strokeWidth = Math.max(2, width * 0.01);
  const points = stroke.points.map((p) => `${p.x * width},${p.y * height}`);
  if (stroke.kind === "arrow") {
    const start = stroke.points[0]!;
    const end = stroke.points[stroke.points.length - 1]!;
    return (
      <line
        className={INK_CLASS[stroke.ink]}
        x1={start.x * width}
        y1={start.y * height}
        x2={end.x * width}
        y2={end.y * height}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={`url(#${markerPrefix}-${stroke.ink})`}
      />
    );
  }
  return (
    <polyline
      className={INK_CLASS[stroke.ink]}
      points={points.join(" ")}
      fill="none"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Token({
  token,
  width,
  height,
}: {
  token: WhiteboardToken;
  width: number;
  height: number;
}) {
  const radius = width * TOKEN_RADIUS_RATIO;
  const cx = token.position.x * width;
  const cy = token.position.y * height;
  if (token.kind === "ball") {
    return (
      <g className={styles.ball}>
        <circle cx={cx} cy={cy} r={radius} strokeWidth={radius * 0.12} />
        {/* Coutures d’un ballon de volley. */}
        <path
          className={styles.ballSeam}
          d={`M${cx - radius * 0.85} ${cy - radius * 0.3} Q${cx} ${cy + radius * 0.2} ${cx + radius * 0.6} ${cy - radius * 0.75}
              M${cx - radius * 0.2} ${cy + radius * 0.95} Q${cx - radius * 0.1} ${cy} ${cx + radius * 0.95} ${cy - radius * 0.1}
              M${cx - radius * 0.6} ${cy - radius * 0.75} Q${cx - radius * 0.2} ${cy + radius * 0.2} ${cx - radius * 0.9} ${cy + radius * 0.4}`}
          fill="none"
          strokeWidth={radius * 0.12}
        />
      </g>
    );
  }
  return (
    <g className={token.kind === "opponent" ? styles.opponent : styles.player}>
      <circle cx={cx} cy={cy} r={radius} strokeWidth={radius * 0.12} />
      {token.label ? (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={radius * 1.05}
          fontWeight={800}
        >
          {token.label}
        </text>
      ) : null}
    </g>
  );
}
