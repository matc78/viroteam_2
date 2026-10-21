"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authCopy } from "@/lib/copy/authCopy";
import { validateEmail } from "@/lib/auth/validateEmail";
import { useAuth } from "@/lib/firebase/AuthProvider";
import styles from "./AuthForm.module.css";

type FieldErrors = {
  email?: string;
  form?: string;
};

function ForgotPasswordFormContent() {
  const searchParams = useSearchParams();
  const { sendPasswordResetEmail } = useAuth();
  const [email, setEmail] = useState(
    () => searchParams.get("email")?.trim() ?? "",
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(email);
      setSent(true);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Envoi du lien impossible. Réessaie dans un instant.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className={styles.successBlock}>
        <p className={styles.successMessage} role="status">
          {authCopy.forgotPasswordEmailSent}
        </p>
        <p className={styles.switch}>
          <Link href="/login" className={styles.switchLink}>
            {authCopy.forgotPasswordBackToLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <form
        className={styles.form}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        aria-busy={submitting || undefined}
      >
        <div className={styles.field}>
          <label className={styles.label} htmlFor="forgot-password-email">
            E-mail
          </label>
          <input
            id="forgot-password-email"
            className={`${styles.input}${errors.email ? ` ${styles.inputInvalid}` : ""}`}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="toi@club.fr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "forgot-password-email-error" : undefined
            }
            disabled={submitting}
          />
          {errors.email ? (
            <p
              id="forgot-password-email-error"
              className={styles.error}
              role="alert"
            >
              {errors.email}
            </p>
          ) : null}
        </div>

        {errors.form ? (
          <p className={styles.error} role="alert">
            {errors.form}
          </p>
        ) : null}

        <button
          className={styles.submit}
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className={styles.submitSpinner} aria-hidden="true" />
              {authCopy.forgotPasswordSending}
            </>
          ) : (
            authCopy.forgotPasswordSend
          )}
        </button>
      </form>

      <p className={styles.switch}>
        <Link href="/login" className={styles.switchLink}>
          {authCopy.forgotPasswordBackToLogin}
        </Link>
      </p>
    </>
  );
}

/** Formulaire d’envoi du lien Firebase « mot de passe oublié ». */
export function ForgotPasswordForm() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <ForgotPasswordFormContent />
    </Suspense>
  );
}
