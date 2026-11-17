"use client";

import { useEffect, useRef, useState } from "react";
import { ChatIcon } from "@/components/chat/ChatIcons";
import { messageImageAspectRatio } from "@/lib/chat/messageImageLayout";
import type { ChatMessage } from "@/lib/firebase/chatTypes";
import styles from "../ChatThreadView.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type MessageImageProps = {
  message: ChatMessage;
  timeLabel: string;
  timeIso: string | undefined;
  onOpenImage: (url: string) => void;
};

type ImageState = "loading" | "loaded" | "error";

/**
 * Photo d’une bulle : emplacement au ratio du message réservé avant le
 * chargement (pas de saut de mise en page), fond de chargement, état
 * « Photo indisponible » si l’image ne se charge pas ; clic = plein écran.
 */
export function MessageImage({
  message,
  timeLabel,
  timeIso,
  onOpenImage,
}: MessageImageProps) {
  const src = message.thumbUrl || message.downloadUrl || "";
  const [state, setState] = useState<ImageState>(src ? "loading" : "error");
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setState("error");
      return;
    }
    // Image déjà en cache : `onLoad` a pu partir avant l’hydratation.
    const img = imgRef.current;
    if (img?.complete) {
      setState(img.naturalWidth > 0 ? "loaded" : "error");
    } else {
      setState("loading");
    }
  }, [src]);

  const fullUrl = message.downloadUrl || message.thumbUrl || "";

  return (
    <div
      className={styles.imageWrap}
      data-state={state}
      style={{
        aspectRatio: messageImageAspectRatio(message.width, message.height),
      }}
    >
      {state === "error" ? (
        <span className={styles.imageError} role="img" aria-label={chatCopy.photoUnavailable}>
          <ChatIcon name="image" size={22} />
          <span aria-hidden>{chatCopy.photoUnavailable}</span>
        </span>
      ) : (
        <button
          type="button"
          className={styles.imageBtn}
          aria-label={chatCopy.enlargePhoto}
          aria-busy={state === "loading" || undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (fullUrl) onOpenImage(fullUrl);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={chatCopy.photoPreview}
            className={styles.image}
            decoding="async"
            onLoad={() => setState("loaded")}
            onError={() => setState("error")}
          />
        </button>
      )}
      <time className={styles.timeOnImage} dateTime={timeIso}>
        {timeLabel}
      </time>
    </div>
  );
}
