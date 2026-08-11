"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./AuthForm.module.css";

type FieldErrors = {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formulaire d’inscription UI — redirige vers /home après validation. */
export function SignupForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!displayName.trim()) {
      next.displayName = "Le nom est requis.";
    }
    if (!email.trim()) {
      next.email = "L’e-mail est requis.";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = "Saisis un e-mail valide.";
    }
    if (!password) {
      next.password = "Le mot de passe est requis.";
    } else if (password.length < 8) {
      next.password = "Au moins 8 caractères.";
    }
    if (!confirmPassword) {
      next.confirmPassword = "Confirme ton mot de passe.";
    } else if (confirmPassword !== password) {
      next.confirmPassword = "Les mots de passe ne correspondent pas.";
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    router.push("/home");
  }

  return (
    <>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-name">
            Nom affiché
          </label>
          <input
            id="signup-name"
            className={`${styles.input}${errors.displayName ? ` ${styles.inputInvalid}` : ""}`}
            type="text"
            name="displayName"
            autoComplete="name"
            placeholder="Alex Dupont"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={
              errors.displayName ? "signup-name-error" : undefined
            }
          />
          {errors.displayName ? (
            <p id="signup-name-error" className={styles.error} role="alert">
              {errors.displayName}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-email">
            E-mail
          </label>
          <input
            id="signup-email"
            className={`${styles.input}${errors.email ? ` ${styles.inputInvalid}` : ""}`}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="toi@club.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
          />
          {errors.email ? (
            <p id="signup-email-error" className={styles.error} role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-password">
            Mot de passe
          </label>
          <input
            id="signup-password"
            className={`${styles.input}${errors.password ? ` ${styles.inputInvalid}` : ""}`}
            type="password"
            name="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password ? "signup-password-error" : undefined
            }
          />
          {errors.password ? (
            <p id="signup-password-error" className={styles.error} role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="signup-confirm">
            Confirmer le mot de passe
          </label>
          <input
            id="signup-confirm"
            className={`${styles.input}${errors.confirmPassword ? ` ${styles.inputInvalid}` : ""}`}
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={
              errors.confirmPassword ? "signup-confirm-error" : undefined
            }
          />
          {errors.confirmPassword ? (
            <p id="signup-confirm-error" className={styles.error} role="alert">
              {errors.confirmPassword}
            </p>
          ) : null}
        </div>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <p className={styles.switch}>
        Déjà un compte ?{" "}
        <Link href="/login" className={styles.switchLink}>
          Se connecter
        </Link>
      </p>
    </>
  );
}
