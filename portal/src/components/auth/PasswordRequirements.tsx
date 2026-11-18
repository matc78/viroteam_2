"use client";

import { passwordRequirements } from "@/lib/auth/passwordPolicy";
import styles from "./PasswordRequirements.module.css";

type PasswordRequirementsProps = {
  /** Mot de passe en cours de saisie. */
  password: string;
  /** id du conteneur pour `aria-describedby`. */
  id?: string;
};

/** Checklist visuelle des règles de mot de passe (état live). */
export function PasswordRequirements({
  password,
  id = "password-requirements",
}: PasswordRequirementsProps) {
  const requirements = passwordRequirements(password);

  return (
    <ul id={id} className={styles.list} aria-live="polite">
      {requirements.map((requirement) => (
        <li
          key={requirement.id}
          className={`${styles.item}${requirement.met ? ` ${styles.itemMet}` : ""}`}
        >
          <span
            className={`${styles.mark}${requirement.met ? ` ${styles.markMet}` : ""}`}
            aria-hidden="true"
          >
            {requirement.met ? "✓" : ""}
          </span>
          <span>
            {requirement.label}
            <span className="sr-only">
              {requirement.met ? " — respectée" : " — non respectée"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
