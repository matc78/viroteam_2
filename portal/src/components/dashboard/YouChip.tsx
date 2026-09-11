import styles from "./YouChip.module.css";

/** Chip « toi » — marque la ligne du membre connecté dans une liste. */
export function YouChip({ className }: { className?: string }) {
  return (
    <span
      className={[styles.chip, className].filter(Boolean).join(" ")}
      title="C’est toi"
    >
      toi
    </span>
  );
}

/**
 * True si la fiche membre correspond au compte Auth courant
 * (`accountUid` ou `memberId` legacy = uid).
 */
export function isCurrentUserMember(
  member: { memberId: string; accountUid?: string | null },
  uid: string | null | undefined,
): boolean {
  if (!uid) return false;
  if (member.accountUid && member.accountUid === uid) return true;
  return member.memberId === uid;
}
