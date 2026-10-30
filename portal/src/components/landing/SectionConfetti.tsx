import styles from "./SectionConfetti.module.css";

type Shape = "dot" | "dash" | "square" | "diamond" | "triangle" | "ring";
type Tone = "cyan" | "orange" | "yellow" | "green" | "blue";

type Piece = {
  shape: Shape;
  tone: Tone;
  top: string;
  left: string;
  rotate?: number;
  /** Masqué sous 700 px pour ne pas charger les petits écrans. */
  sparse?: boolean;
};

/**
 * Jeux de confettis par section, placés surtout dans les marges pour ne pas
 * passer sous le texte. Varier les jeux évite l'effet « motif répété ».
 */
const presets: Record<"a" | "b" | "c" | "d", readonly Piece[]> = {
  a: [
    { shape: "triangle", tone: "orange", top: "8%", left: "3%", rotate: 12 },
    { shape: "dot", tone: "cyan", top: "22%", left: "47%", sparse: true },
    { shape: "dash", tone: "yellow", top: "14%", left: "92%", rotate: 35 },
    { shape: "ring", tone: "blue", top: "46%", left: "1.5%" },
    { shape: "square", tone: "green", top: "70%", left: "6%", rotate: 20, sparse: true },
    { shape: "diamond", tone: "cyan", top: "62%", left: "95%", rotate: 45 },
    { shape: "dot", tone: "orange", top: "88%", left: "40%", sparse: true },
    { shape: "dash", tone: "blue", top: "84%", left: "88%", rotate: -20, sparse: true },
  ],
  b: [
    { shape: "square", tone: "yellow", top: "6%", left: "94%", rotate: 15 },
    { shape: "dash", tone: "cyan", top: "18%", left: "4%", rotate: -30 },
    { shape: "triangle", tone: "green", top: "40%", left: "96%", rotate: -10, sparse: true },
    { shape: "dot", tone: "orange", top: "55%", left: "2.5%" },
    { shape: "ring", tone: "cyan", top: "78%", left: "93%", sparse: true },
    { shape: "diamond", tone: "orange", top: "90%", left: "8%", rotate: 45, sparse: true },
  ],
  c: [
    { shape: "dot", tone: "yellow", top: "10%", left: "5%" },
    { shape: "ring", tone: "orange", top: "12%", left: "90%" },
    { shape: "dash", tone: "green", top: "35%", left: "97%", rotate: 60, sparse: true },
    { shape: "triangle", tone: "cyan", top: "58%", left: "2%", rotate: -15 },
    { shape: "square", tone: "blue", top: "80%", left: "94%", rotate: 30, sparse: true },
    { shape: "dash", tone: "orange", top: "92%", left: "20%", rotate: 10, sparse: true },
  ],
  d: [
    { shape: "diamond", tone: "yellow", top: "12%", left: "96%", rotate: 45 },
    { shape: "triangle", tone: "orange", top: "30%", left: "3%", rotate: 25, sparse: true },
    { shape: "dot", tone: "green", top: "52%", left: "92%" },
    { shape: "dash", tone: "cyan", top: "70%", left: "4%", rotate: -40 },
    { shape: "ring", tone: "yellow", top: "88%", left: "85%", sparse: true },
  ],
};

const shapeClass: Record<Shape, string> = {
  dot: styles.dot,
  dash: styles.dash,
  square: styles.square,
  diamond: styles.diamond,
  triangle: styles.triangle,
  ring: styles.ring,
};

const toneClass: Record<Tone, string> = {
  cyan: styles.cyan,
  orange: styles.orange,
  yellow: styles.yellow,
  green: styles.green,
  blue: styles.blue,
};

/** Confettis géométriques décoratifs derrière une section blanche de la landing. */
export function SectionConfetti({ preset = "a" }: { preset?: keyof typeof presets }) {
  return (
    <div className={styles.layer} aria-hidden="true">
      {presets[preset].map((piece, index) => (
        <span
          key={`${piece.shape}-${index}`}
          className={[
            styles.piece,
            shapeClass[piece.shape],
            toneClass[piece.tone],
            piece.sparse ? styles.sparse : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            top: piece.top,
            left: piece.left,
            transform: piece.rotate !== undefined ? `rotate(${piece.rotate}deg)` : undefined,
          }}
        />
      ))}
    </div>
  );
}
