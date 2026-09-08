"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClubMemberCountRanges,
  ClubObjectives,
} from "@/lib/clubSetup/constants";
import { ObjectiveChip } from "@/components/clubSetup/ObjectiveChip";
import selectable from "@/components/clubSetup/SetupSelectable.module.css";
import styles from "./ObjectivesStep.module.css";

type ObjectivesStepProps = {
  selected: Set<string>;
  memberCountRange: string | null;
  onToggle: (key: string) => void;
  onMemberCountChanged: (range: string | null) => void;
};

/** Étape objectifs — priorités produit et taille du club. */
export function ObjectivesStep({
  selected,
  memberCountRange,
  onToggle,
  onMemberCountChanged,
}: ObjectivesStepProps) {
  return (
    <div className={styles.layout}>
      <div className={styles.objectiveGrid}>
        {ClubObjectives.all.map((objectiveKey) => (
          <ObjectiveChip
            key={objectiveKey}
            objectiveKey={objectiveKey}
            selected={selected.has(objectiveKey)}
            onToggle={() => onToggle(objectiveKey)}
          />
        ))}
      </div>

      <div className={styles.memberCountSection}>
        <p className={styles.memberCountTitle}>Combien de membres gérez-vous ?</p>
        <MemberCountCarousel
          selectedValue={memberCountRange}
          onSelect={onMemberCountChanged}
        />
      </div>
    </div>
  );
}

type MemberCountCarouselProps = {
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
};

/** Rangée de chiffres scrollable avec flèche droite si débordement. */
function MemberCountCarousel({
  selectedValue,
  onSelect,
}: MemberCountCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
    setCanScrollLeft(viewport.scrollLeft > 2);
    setCanScrollRight(maxScrollLeft - viewport.scrollLeft > 2);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateScrollState();
    const resizeObserver = new ResizeObserver(() => updateScrollState());
    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
    };
  }, [updateScrollState]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !selectedValue) return;
    const selectedChip = viewport.querySelector<HTMLElement>(
      `[data-member-count="${selectedValue}"]`,
    );
    if (!selectedChip) return;
    selectedChip.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [selectedValue]);

  function scrollByPage(direction: 1 | -1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const pageWidth = Math.max(viewport.clientWidth * 0.7, 120);
    viewport.scrollBy({ left: direction * pageWidth, behavior: "smooth" });
  }

  return (
    <div className={styles.memberCountCarousel}>
      {canScrollLeft ? (
        <button
          type="button"
          className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
          onClick={() => scrollByPage(-1)}
          aria-label="Voir les effectifs précédents"
        >
          <CarouselChevron direction="left" />
        </button>
      ) : null}

      <div
        ref={viewportRef}
        className={[
          styles.memberCountViewport,
          canScrollLeft ? styles.memberCountViewportFadeLeft : "",
          canScrollRight ? styles.memberCountViewportFadeRight : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="listbox"
        aria-label="Nombre de membres"
      >
        <div className={styles.memberCountRow}>
          {ClubMemberCountRanges.all.map((value) => {
            const isSelected = selectedValue === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                data-member-count={value}
                aria-selected={isSelected}
                className={`${selectable.tile} ${styles.rangeChip} ${isSelected ? selectable.tileSelected : ""}`}
                onClick={() => onSelect(isSelected ? null : value)}
              >
                {ClubMemberCountRanges.label(value)}
              </button>
            );
          })}
        </div>
      </div>

      {canScrollRight ? (
        <button
          type="button"
          className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
          onClick={() => scrollByPage(1)}
          aria-label="Voir les effectifs suivants"
        >
          <CarouselChevron direction="right" />
        </button>
      ) : null}
    </div>
  );
}

function CarouselChevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={direction === "left" ? styles.chevronFlip : undefined}
    >
      <path
        d="M6 3.5L10.5 8L6 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
