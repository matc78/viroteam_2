"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import styles from "./AuthForm.module.css";

type FieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Formulaire de connexion UI — redirige vers /home après validation. */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
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
          <label className={styles.label} htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            className={`${styles.input}${errors.email ? ` ${styles.inputInvalid}` : ""}`}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="toi@club.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
          />
          {errors.email ? (
            <p id="login-email-error" className={styles.error} role="alert">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-password">
            Mot de passe
          </label>
          <input
            id="login-password"
            className={`${styles.input}${errors.password ? ` ${styles.inputInvalid}` : ""}`}
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
          />
          {errors.password ? (
            <p id="login-password-error" className={styles.error} role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>

        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className={styles.switch}>
        Pas encore de compte ?{" "}
        <Link href="/signup" className={styles.switchLink}>
          Créer un compte
        </Link>
      </p>
    </>
  );
}
