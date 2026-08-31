import { ClubSetupSteps } from "@/lib/clubSetup/constants";
import {
  ClubSetupProgressIcons,
  isClubSetupProgressIconCompleted,
  isClubSetupProgressIconCurrent,
  isClubSetupProgressIconNavigable,
  isClubSetupProgressIconReached,
} from "@/lib/clubSetup/clubSetupStepAccents";
import { ClubSetupSportIcon } from "@/components/clubSetup/SetupSportIcons";
import styles from "./SetupSportProgress.module.css";

type SetupSportProgressProps = {
  currentStep: number;
  onStepSelect?: (step: number) => void;
  wide?: boolean;
};

/** Progression sportive hors cadre (6 pictos allumés étape par étape). */
export function SetupSportProgress({
  currentStep,
  onStepSelect,
  wide = false,
}: SetupSportProgressProps) {
  const stepIndex = ClubSetupSteps.clampIndex(currentStep);
  const stepLabel = ClubSetupSteps.labels[stepIndex];

  return (
    <nav
      className={[styles.nav, wide ? styles.navWide : ""].filter(Boolean).join(" ")}
      aria-label={`Progression : étape ${stepIndex + 1} sur ${ClubSetupSteps.total}, ${stepLabel}`}
    >
      <ol className={styles.iconRow}>
        {ClubSetupProgressIcons.map((icon, iconIndex) => {
          const isReached = isClubSetupProgressIconReached(currentStep, iconIndex);
          const isCurrent = isClubSetupProgressIconCurrent(currentStep, iconIndex);
          const isCompleted = isClubSetupProgressIconCompleted(currentStep, iconIndex);
          const isNavigable = isClubSetupProgressIconNavigable(currentStep, iconIndex);
          const accentStyle =
            isReached || isCurrent
              ? ({ ["--icon-accent" as string]: icon.accent } as React.CSSProperties)
              : undefined;

          const badgeClassName = [
            styles.iconBadge,
            isReached ? styles.iconBadgeReached : "",
            isCurrent ? styles.iconBadgeCurrent : "",
            isCompleted ? styles.iconBadgeCompleted : "",
          ]
            .filter(Boolean)
            .join(" ");

          const itemClassName = [
            styles.iconItem,
            isReached ? styles.iconItemReached : "",
            isCurrent ? styles.iconItemCurrent : "",
            isCompleted ? styles.iconItemCompleted : "",
            isNavigable ? styles.iconItemNavigable : "",
          ]
            .filter(Boolean)
            .join(" ");

          const badge = (
            <div className={badgeClassName} style={accentStyle}>
              <ClubSetupSportIcon
                src={icon.src}
                alt=""
                isReached={isReached}
                isCurrent={isCurrent}
              />
            </div>
          );

          const label = <span className={styles.iconLabel}>{icon.title}</span>;

          return (
            <li
              key={icon.id}
              className={itemClassName}
              style={accentStyle}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isNavigable && onStepSelect ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onStepSelect(icon.stepIndex)}
                  aria-label={`Revenir à ${icon.title}`}
                >
                  {badge}
                  {label}
                </button>
              ) : (
                <div className={styles.iconStatic} title={icon.title}>
                  {badge}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
