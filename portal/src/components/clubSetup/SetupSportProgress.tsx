import { ClubSetupSteps } from "@/lib/clubSetup/constants";
import {
  ClubSetupProgressIcons,
  isClubSetupProgressIconCompleted,
  isClubSetupProgressIconCreationBlink,
  isClubSetupProgressIconCurrent,
  isClubSetupProgressIconNavigable,
  isClubSetupProgressIconReached,
} from "@/lib/clubSetup/clubSetupStepAccents";
import { ClubSetupSportIcon } from "@/components/clubSetup/SetupSportIcons";
import styles from "./SetupSportProgress.module.css";

type SetupSportProgressProps = {
  currentStep: number;
  maxReachedStep: number;
  onStepSelect?: (step: number) => void;
  /** Même action que le bouton « Créer le club » (icône Création sur Vérification). */
  onCreateClick?: () => void;
  createDisabled?: boolean;
  wide?: boolean;
};

/** Progression sportive hors cadre (6 pictos allumés étape par étape). */
export function SetupSportProgress({
  currentStep,
  maxReachedStep,
  onStepSelect,
  onCreateClick,
  createDisabled = false,
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
          const isCreationBlink = isClubSetupProgressIconCreationBlink(
            currentStep,
            iconIndex,
          );
          const isReached =
            !isCreationBlink &&
            isClubSetupProgressIconReached(maxReachedStep, iconIndex);
          const isCurrent = isClubSetupProgressIconCurrent(currentStep, iconIndex);
          const isCompleted = isClubSetupProgressIconCompleted(
            maxReachedStep,
            iconIndex,
          );
          const isNavigable = isClubSetupProgressIconNavigable(
            currentStep,
            maxReachedStep,
            iconIndex,
          );
          const accentStyle =
            isReached || isCurrent || isCreationBlink
              ? ({ ["--icon-accent" as string]: icon.accent } as React.CSSProperties)
              : undefined;

          const badgeClassName = [
            styles.iconBadge,
            isReached ? styles.iconBadgeReached : "",
            isCurrent ? styles.iconBadgeCurrent : "",
            isCompleted ? styles.iconBadgeCompleted : "",
            isCreationBlink ? styles.iconBadgeCreationBlink : "",
          ]
            .filter(Boolean)
            .join(" ");

          const itemClassName = [
            styles.iconItem,
            isReached ? styles.iconItemReached : "",
            isCurrent ? styles.iconItemCurrent : "",
            isCompleted ? styles.iconItemCompleted : "",
            isNavigable ? styles.iconItemNavigable : "",
            isCreationBlink ? styles.iconItemCreationBlink : "",
          ]
            .filter(Boolean)
            .join(" ");

          const badge = (
            <div className={badgeClassName} style={accentStyle}>
              <ClubSetupSportIcon
                src={icon.src}
                alt=""
                isReached={isReached || isCreationBlink}
                isCurrent={isCurrent}
                isBlinking={isCreationBlink}
              />
            </div>
          );

          const label = <span className={styles.iconLabel}>{icon.title}</span>;
          const goForward = icon.stepIndex > currentStep;
          const selectLabel = goForward
            ? `Aller à ${icon.title}`
            : `Revenir à ${icon.title}`;
          const isCreateAction = isCreationBlink && Boolean(onCreateClick);

          return (
            <li
              key={icon.id}
              className={[
                itemClassName,
                isCreateAction ? styles.iconItemNavigable : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={accentStyle}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isCreateAction && onCreateClick ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={onCreateClick}
                  disabled={createDisabled}
                  aria-label="Créer le club"
                >
                  {badge}
                  {label}
                </button>
              ) : isNavigable && onStepSelect ? (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => onStepSelect(icon.stepIndex)}
                  aria-label={selectLabel}
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
