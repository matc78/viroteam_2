"use client";

import {
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { OverlayFadeScrollbar } from "@/components/dashboard/OverlayFadeScrollbar";
import styles from "./FadeScrollArea.module.css";

export type FadeScrollAxis = "vertical" | "horizontal" | "both";

type FadeScrollAreaProps = {
  children: ReactNode;
  /** Classes du wrap (position relative). */
  className?: string;
  /** Style du wrap (ex. position fixed d’un dropdown). */
  style?: CSSProperties;
  /** Classes du viewport scrollable. */
  viewportClassName?: string;
  axis?: FadeScrollAxis;
  /** Ref externe vers le wrap (ex. dismiss outside). */
  wrapRef?: RefObject<HTMLDivElement | null>;
  /** Ref externe vers le viewport (ex. scrollTo). */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Élément HTML du viewport (div par défaut). */
  as?: "div" | "ul";
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children" | "style">;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as { current: T | null }).current = value;
}

/**
 * Zone scrollable : scrollbar native masquée + overlay fade (sans flèches).
 */
export function FadeScrollArea({
  children,
  className,
  style,
  viewportClassName,
  axis = "vertical",
  wrapRef,
  scrollRef: externalScrollRef,
  as = "div",
  ...viewportProps
}: FadeScrollAreaProps) {
  const internalScrollRef = useRef<HTMLElement | null>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;

  const showVertical = axis === "vertical" || axis === "both";
  const showHorizontal = axis === "horizontal" || axis === "both";

  const overflowClass =
    axis === "horizontal"
      ? styles.viewportHorizontal
      : axis === "both"
        ? styles.viewportBoth
        : styles.viewportVertical;

  const viewportClass = [styles.viewport, overflowClass, viewportClassName]
    .filter(Boolean)
    .join(" ");

  const setViewportRef = (node: HTMLElement | null) => {
    internalScrollRef.current = node;
    assignRef(externalScrollRef, node);
  };

  const setWrapRef = (node: HTMLDivElement | null) => {
    assignRef(wrapRef, node);
  };

  const ViewportTag = as;

  return (
    <div
      ref={setWrapRef}
      className={[styles.wrap, className].filter(Boolean).join(" ")}
      style={style}
    >
      <ViewportTag
        {...(viewportProps as HTMLAttributes<HTMLElement>)}
        ref={setViewportRef as never}
        className={viewportClass}
      >
        {children}
      </ViewportTag>
      {showVertical ? (
        <OverlayFadeScrollbar scrollRef={scrollRef} axis="vertical" />
      ) : null}
      {showHorizontal ? (
        <OverlayFadeScrollbar scrollRef={scrollRef} axis="horizontal" />
      ) : null}
    </div>
  );
}
