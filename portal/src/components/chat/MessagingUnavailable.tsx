"use client";

import { useReportPageReady } from "@/components/common/PageLoadProvider";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { chatCopy } from "@/lib/copy/chatCopy";

/**
 * Page Messagerie quand la messagerie n’est pas encore ouverte au compte :
 * état vide explicite plutôt qu’une page blanche (lien direct, push).
 */
export function MessagingUnavailable({
  eyebrow,
  pageRoute,
  homeHref,
}: {
  eyebrow: string;
  /** Route signalée prête au voile de chargement. */
  pageRoute: string;
  /** Accueil de l’espace (bureau ou famille). */
  homeHref: string;
}) {
  useReportPageReady(true, pageRoute);
  return (
    <div>
      <DashboardPageIntro eyebrow={eyebrow} heading={chatCopy.chatEntry} />
      <EmptyState
        variant="block"
        title={chatCopy.messagingUnavailableTitle}
        action={
          <ButtonLink href={homeHref} variant="primary">
            {chatCopy.messagingUnavailableAction}
          </ButtonLink>
        }
      >
        {chatCopy.messagingUnavailableText}
      </EmptyState>
    </div>
  );
}
