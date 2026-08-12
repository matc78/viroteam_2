"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { handleGoogleAuthError } from "@/lib/auth/handleGoogleAuthError";
import { usePostAuthRedirect } from "@/lib/auth/usePostAuthRedirect";
import { validateEmail } from "@/lib/auth/validateEmail";
import { useAuth } from "@/lib/firebase/AuthProvider";
import styles from "./AuthForm.module.css";

type FieldErrors = {
  email?: string;
  password?: string;
  form?: string;
};

function LoginFormContent() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  usePostAuthRedirect();

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!password) {
      nextErrors.password = "Le mot de passe est requis.";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Connexion impossible.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setErrors({});
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const result = handleGoogleAuthError(error);
      if (result.emailToPrefill) setEmail(result.emailToPrefill);
      setErrors({ form: result.formMessage });
      if (result.shouldStopLoading) setGoogleLoading(false);
    }
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
          <div className={styles.passwordField}>
            <input
              id="login-password"
              className={`${styles.input}${errors.password ? ` ${styles.inputInvalid}` : ""}`}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "login-password-error" : undefined
              }
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={
                showPassword
                  ? "Masquer le mot de passe"
                  : "Afficher le mot de passe"
              }
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.14C55.46,186.53,83.34,200,112,200a117.55,117.55,0,0,0,32.9-4.73l30.17,33.17a8,8,0,1,0,11.84-10.76ZM128,184c-22.09,0-42.15-9.15-58.25-26.08a133.16,133.16,0,0,1-18.22-24.47L76.69,152A32,32,0,0,0,128,184Zm81.67-59.58C193.75,102.43,165.87,88,137.21,88a8,8,0,0,0,0,16,32,32,0,0,1,32,32,8,8,0,0,0,16,0,47.84,47.84,0,0,0-1.37-8.62l30.4,33.46a8,8,0,0,0,11.84-10.76ZM187.45,158.55A32,32,0,0,1,168,164a8,8,0,0,1,0-16,15.87,15.87,0,0,0,2.34-.18Z" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 256 256"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.14C202.57,57.67,174.69,44,144,44S85.43,57.67,66.34,86.62C47.51,105.18,39,124,38.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.14C85.43,198.33,113.31,212,144,212s58.57-13.67,77.66-42.62c18.83-18.57,27.3-37.35,27.65-38.14A8,8,0,0,0,247.31,124.76ZM144,196c-22.09,0-42.15-9.15-58.25-26.08a133.16,133.16,0,0,1-18.22-24.47A133.16,133.16,0,0,1,85.75,121.08C101.85,104.15,121.91,95,144,95s42.15,9.15,58.25,26.08a133.16,133.16,0,0,1,18.22,24.47A133.16,133.16,0,0,1,202.25,169.92C186.15,186.85,166.09,196,144,196Zm0-84a32,32,0,1,0,32,32A32,32,0,0,0,144,112Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,144,160Z" />
                </svg>
              )}
            </button>
          </div>
          {errors.password ? (
            <p id="login-password-error" className={styles.error} role="alert">
              {errors.password}
            </p>
          ) : null}
        </div>

        {errors.form ? (
          <p className={styles.error} role="alert">
            {errors.form}
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={submitting || googleLoading}>
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <AuthDivider />

      <GoogleSignInButton
        onClick={handleGoogleSignIn}
        loading={googleLoading}
        disabled={submitting}
      />

      <p className={styles.switch}>
        Pas encore de compte ?{" "}
        <Link href="/signup" className={styles.switchLink}>
          Créer un compte
        </Link>
      </p>
    </>
  );
}

/** Formulaire de connexion Firebase Auth. */
export function LoginForm() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <LoginFormContent />
    </Suspense>
  );
}
