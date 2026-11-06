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
 * True si la fiche membre est celle du compte Auth courant
 * (une fiche liée vit à `members/{uid}`).
 */
export function isCurrentUserMember(
  member: { memberId: string },
  uid: string | null | undefined,
): boolean {
  return Boolean(uid) && member.memberId === uid;
}
