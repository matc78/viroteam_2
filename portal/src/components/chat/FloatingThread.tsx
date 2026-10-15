"use client";

import { ChatThreadView } from "@/components/chat/ChatThreadView";
import { useChat } from "@/lib/chat/ChatProvider";
import { chatStateDocId, type ChatThreadKey } from "@/lib/firebase/chatTypes";
import { useDialogA11y } from "@/lib/ui/useDialogA11y";
import styles from "./FloatingThread.module.css";

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
  const dialogRef = useDialogA11y({ onClose: closeFloatingThread });
  const stateId = chatStateDocId(thread.clubId, thread.conversationId);
  const clubName = clubNameById[thread.clubId];

  return (
    <div
      ref={dialogRef}
      className={styles.window}
      role="dialog"
      aria-modal="true"
      aria-label="Conversation"
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
            <span className={styles.clubLabel}>{clubName}</span>
          ) : null
        }
      />
    </div>
  );
}
