"use client";

import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import styles from "./OverlayFadeScrollbar.module.css";

export type ScrollAxis = "vertical" | "horizontal";

type OverlayFadeScrollbarProps = {
  scrollRef: RefObject<HTMLElement | null>;
  axis?: ScrollAxis;
  hideDelayMs?: number;
  fadeDurationMs?: number;
};

type ThumbMetrics = {
  offset: number;
  size: number;
  needed: boolean;
};

type ScrollPhase = "hidden" | "visible" | "fading";

/**
 * Scrollbar custom (sans flèches natives Windows) :
 * visible pendant le scroll, puis fondu. Axe vertical ou horizontal.
 */
export function OverlayFadeScrollbar({
  scrollRef,
  axis = "vertical",
  hideDelayMs = 650,
  fadeDurationMs = 1100,
}: OverlayFadeScrollbarProps) {
  const [metrics, setMetrics] = useState<ThumbMetrics>({
    offset: 0,
    size: 0,
    needed: false,
  });
  const [phase, setPhase] = useState<ScrollPhase>("hidden");

  const updateMetrics = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;

    if (axis === "vertical") {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const needed = scrollHeight > clientHeight + 1;
      if (!needed) {
        setMetrics({ offset: 0, size: 0, needed: false });
        return;
      }
      const ratio = clientHeight / scrollHeight;
      const size = Math.max(24, clientHeight * ratio);
      const maxOffset = clientHeight - size;
      const offset =
        maxOffset <= 0
          ? 0
          : (scrollTop / (scrollHeight - clientHeight)) * maxOffset;
      setMetrics({ offset, size, needed: true });
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = element;
    const needed = scrollWidth > clientWidth + 1;
    if (!needed) {
      setMetrics({ offset: 0, size: 0, needed: false });
      return;
    }
    const ratio = clientWidth / scrollWidth;
    const size = Math.max(24, clientWidth * ratio);
    const maxOffset = clientWidth - size;
    const offset =
      maxOffset <= 0
        ? 0
        : (scrollLeft / (scrollWidth - clientWidth)) * maxOffset;
    setMetrics({ offset, size, needed: true });
  }, [scrollRef, axis]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    function clearTimers() {
      if (hideTimer) clearTimeout(hideTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      hideTimer = undefined;
      fadeTimer = undefined;
    }

    function reveal() {
      updateMetrics();
      setPhase("visible");
      clearTimers();
      hideTimer = setTimeout(() => {
        setPhase("fading");
        fadeTimer = setTimeout(() => {
          setPhase("hidden");
          fadeTimer = undefined;
        }, fadeDurationMs);
      }, hideDelayMs);
    }

    updateMetrics();
    element.addEventListener("scroll", reveal, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics();
    });
    resizeObserver.observe(element);
    if (element.firstElementChild) {
      resizeObserver.observe(element.firstElementChild);
    }

    return () => {
      element.removeEventListener("scroll", reveal);
      resizeObserver.disconnect();
      clearTimers();
    };
  }, [scrollRef, hideDelayMs, fadeDurationMs, updateMetrics]);

  if (!metrics.needed) return null;

  const thumbStyle =
    axis === "vertical"
      ? ({
          "--thumb-top": `${metrics.offset}px`,
          "--thumb-height": `${metrics.size}px`,
        } as CSSProperties)
      : ({
          "--thumb-left": `${metrics.offset}px`,
          "--thumb-width": `${metrics.size}px`,
        } as CSSProperties);

  return (
    <div
      className={styles.rail}
      data-axis={axis}
      data-phase={phase}
      aria-hidden="true"
    >
      <div className={styles.thumb} style={thumbStyle} />
    </div>
  );
}
