"use client";

import { ChatThreadView } from "@/components/chat/ChatThreadView";
import { ClubBadge } from "@/components/chat/ClubBadge";
import { useChat } from "@/lib/chat/ChatProvider";
import { chatStateDocId, type ChatThreadKey } from "@/lib/firebase/chatTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./FloatingThread.module.css";
import { chatCopy } from "@/lib/copy/chatCopy";

type FloatingThreadProps = {
  thread: ChatThreadKey;
};

/** Fenêtre flottante unique (thread actif au-dessus du contenu). */
export function FloatingThread({ thread }: FloatingThreadProps) {
  const {
    chatStates,
    clubNameById,
    clubColorById,
    roleForClub,
    closeFloatingThread,
    maximizeThread,
  } = useChat();
  // Non modale : le dock et la page restent joignables au clavier (Tab).
  const dialogRef = useDialogA11y({
    onClose: closeFloatingThread,
    modal: false,
  });
  const stateId = chatStateDocId(thread.clubId, thread.conversationId);
  const clubName = clubNameById[thread.clubId];

  return (
    <div
      ref={dialogRef}
      className={styles.window}
      role="dialog"
      aria-label={chatCopy.floatingThreadLabel}
    >
      <ChatThreadView
        key={`${thread.clubId}-${thread.conversationId}`}
        clubId={thread.clubId}
        conversationId={thread.conversationId}
        clubRole={roleForClub(thread.clubId)}
        chatState={chatStates[stateId]}
        compact
        clubName={clubName}
        clubColor={clubColorById[thread.clubId]}
        onClose={closeFloatingThread}
        onMaximize={maximizeThread}
        headerExtra={
          clubName ? (
            <ClubBadge name={clubName} color={clubColorById[thread.clubId]} />
          ) : null
        }
      />
    </div>
  );
}
