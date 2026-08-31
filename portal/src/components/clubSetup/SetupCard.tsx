import type { ReactNode } from "react";
import cardStyles from "./SetupCard.module.css";

type SetupCardProps = {
  children: ReactNode;
  accent?: string;
  className?: string;
};

/** Carte interne du wizard (style aligné sur les champs auth). */
export function SetupCard({ children, accent, className }: SetupCardProps) {
  const classes = [cardStyles.setupCard, className ?? ""].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={
        accent
          ? ({
              borderColor: `color-mix(in srgb, ${accent} 35%, var(--color-gray-200))`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
