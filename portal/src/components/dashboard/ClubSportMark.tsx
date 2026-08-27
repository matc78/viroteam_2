import { sportEmoji } from "@/lib/sports/sportEmoji";
import styles from "./ClubSportMark.module.css";

type ClubSportMarkProps = {
  sport: string | null | undefined;
  size?: "sm" | "md";
  className?: string;
};

/** Pastille club : objet/emoji du sport (remplace la lettre initiale). */
export function ClubSportMark({
  sport,
  size = "md",
  className,
}: ClubSportMarkProps) {
  return (
    <span
      className={[styles.mark, styles[size], className].filter(Boolean).join(" ")}
      aria-hidden
    >
      {sportEmoji(sport)}
    </span>
  );
}
