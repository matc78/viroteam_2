import styles from "./DecorShapes.module.css";

type ConfettiKind = "dot" | "dash" | "sq" | "diamond";

type ConfettiPiece = {
  kind: ConfettiKind;
  top: string;
  left: string;
  color: "cyan" | "orange" | "yellow" | "green" | "blue";
  size?: "sm" | "md";
  rotate?: number;
};

/** Petits confettis sparses répartis sur toute la hauteur de page. */
const confetti: readonly ConfettiPiece[] = [
  { kind: "dot", top: "6%", left: "8%", color: "cyan", size: "sm" },
  { kind: "sq", top: "5%", left: "71%", color: "yellow", rotate: 18, size: "sm" },
  { kind: "diamond", top: "14%", left: "42%", color: "blue", rotate: 45 },
  { kind: "dot", top: "21%", left: "4%", color: "yellow", size: "sm" },
  { kind: "dash", top: "31%", left: "16%", color: "blue", rotate: 48 },
  { kind: "sq", top: "41%", left: "67%", color: "cyan", rotate: 8, size: "sm" },
  { kind: "dot", top: "48%", left: "84%", color: "blue", size: "md" },
  { kind: "dash", top: "55%", left: "27%", color: "yellow", rotate: 15 },
  { kind: "dot", top: "62%", left: "12%", color: "cyan", size: "sm" },
  { kind: "diamond", top: "68%", left: "39%", color: "blue", rotate: 40 },
  { kind: "sq", top: "74%", left: "21%", color: "cyan", rotate: 28, size: "sm" },
  { kind: "diamond", top: "84%", left: "81%", color: "cyan", rotate: 30 },
  { kind: "dash", top: "90%", left: "30%", color: "blue", rotate: -25 },
  { kind: "dot", top: "93%", left: "58%", color: "green", size: "md" },
] as const;

const colorClass: Record<ConfettiPiece["color"], string> = {
  cyan: styles.cCyan,
  orange: styles.cOrange,
  yellow: styles.cYellow,
  green: styles.cGreen,
  blue: styles.cBlue,
};

const kindClass: Record<ConfettiKind, string> = {
  dot: styles.confettiDot,
  dash: styles.confettiDash,
  sq: styles.confettiSq,
  diamond: styles.confettiDiamond,
};

/** Formes décoratives + confettis qui défilent avec la page. */
export function DecorShapes() {
  return (
    <div className={styles.layer} aria-hidden="true">
      <span className={`${styles.shape} ${styles.circleA}`} />
      <span className={`${styles.shape} ${styles.circleB}`} />
      <span className={`${styles.shape} ${styles.circleC}`} />
      <span className={`${styles.shape} ${styles.circleD}`} />
      <span className={`${styles.shape} ${styles.circleE}`} />
      <span className={`${styles.shape} ${styles.ringA}`} />
      <span className={`${styles.shape} ${styles.ringB}`} />
      <span className={`${styles.shape} ${styles.arcA}`} />
      <span className={`${styles.shape} ${styles.arcB}`} />
      <span className={`${styles.shape} ${styles.dotA}`} />
      <span className={`${styles.shape} ${styles.dotB}`} />
      <span className={`${styles.shape} ${styles.dotC}`} />
      <span className={`${styles.shape} ${styles.pill}`} />
      <span className={`${styles.shape} ${styles.square}`} />

      {confetti.map((piece, index) => {
        const sizeClass =
          piece.size === "md" ? styles.confettiMd : styles.confettiSm;
        const rotate =
          piece.rotate !== undefined ? `rotate(${piece.rotate}deg)` : undefined;

        return (
          <span
            key={`${piece.kind}-${index}`}
            className={`${styles.shape} ${styles.confetti} ${kindClass[piece.kind]} ${colorClass[piece.color]} ${sizeClass}${index % 2 === 1 ? ` ${styles.confettiSparse}` : ""}`}
            style={{
              top: piece.top,
              left: piece.left,
              transform: rotate,
            }}
          />
        );
      })}
    </div>
  );
}
