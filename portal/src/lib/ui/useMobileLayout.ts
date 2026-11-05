"use client";

import { useEffect, useState } from "react";
import { chatMobileMediaQuery } from "@/lib/chat/chatBreakpoints";

/**
 * `true` sous le seuil mobile du chat (≤ 767 px). Partagé hors messagerie
 * pour masquer des actions peu pratiques sur téléphone (ex. import CSV).
 */
export function useMobileLayout(): boolean {
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(chatMobileMediaQuery);
    const update = () => setIsMobileLayout(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobileLayout;
}
