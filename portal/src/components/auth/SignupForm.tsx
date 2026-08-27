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
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
  form?: string;
};

/** Formulaire d’inscription Firebase Auth + profil users/{uid}. */
export function SignupForm() {
  return (
    <Suspense fallback={<p>Chargement…</p>}>
      <SignupFormContent />
    </Suspense>
  );
}

function SignupFormContent() {
  const { signUp, signInWithGoogle } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  usePostAuthRedirect({ accessDeniedFromSignup: true });

  function validate(): FieldErrors {
    const nextErrors: FieldErrors = {};
    if (!displayName.trim()) {
      nextErrors.displayName = "Le nom est requis.";
    }
    const emailError = validateEmail(email);
    if (emailError) nextErrors.email = emailError;
    if (!password) {
      nextErrors.password = "Le mot de passe est requis.";
    } else if (password.length < 8) {
      nextErrors.password = "Au moins 8 caractères.";
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirme ton mot de passe.";
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = "Les mots de passe ne correspondent pas.";
    }
    if (!acceptTerms) {
      nextErrors.acceptTerms =
        "Tu dois accepter les CGU et la politique de confidentialité.";
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
      await signUp({ email, password, displayName });
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Inscription impossible.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    if (!acceptTerms) {
      setErrors({
        acceptTerms:
          "Tu dois accepter les CGU et la politique de confidentialité.",
      });
      return;
    }
    setErrors({});
    setGoogleLoading(true);
    try {
      await signInWithGoogle({ createProfileIfMissing: true });
    } catch (error) {
      const result = handleGoogleAuthError(error, "Inscription Google impossible.");
      if (result.emailToPrefill) setEmail(result.emailToPrefill);
      setErrors({ form: result.formMessage });
      if (result.shouldStopLoading) setGoogleLoading(false);
    }
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
            placeholder="Tristan Heraud"
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
          <div className={styles.passwordField}>
            <input
              id="signup-password"
              className={`${styles.input}${errors.password ? ` ${styles.inputInvalid}` : ""}`}
              type={showPassword ? "text" : "password"}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                  <path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L61.32,66.55C25,88.84,9.38,123.2,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.14C55.46,186.53,83.34,200,112,200a117.55,117.55,0,0,0,32.9-4.73l30.17,33.17a8,8,0,1,0,11.84-10.76ZM128,184c-22.09,0-42.15-9.15-58.25-26.08a133.16,133.16,0,0,1-18.22-24.47L76.69,152A32,32,0,0,0,128,184Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                  <path d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.14C202.57,57.67,174.69,44,144,44S85.43,57.67,66.34,86.62C47.51,105.18,39,124,38.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.14C85.43,198.33,113.31,212,144,212s58.57-13.67,77.66-42.62c18.83-18.57,27.3-37.35,27.65-38.14A8,8,0,0,0,247.31,124.76ZM144,196c-22.09,0-42.15-9.15-58.25-26.08a133.16,133.16,0,0,1-18.22-24.47A133.16,133.16,0,0,1,85.75,121.08C101.85,104.15,121.91,95,144,95s42.15,9.15,58.25,26.08a133.16,133.16,0,0,1,18.22,24.47A133.16,133.16,0,0,1,202.25,169.92C186.15,186.85,166.09,196,144,196Zm0-84a32,32,0,1,0,32,32A32,32,0,0,0,144,112Zm0,48a16,16,0,1,1,16-16A16,16,0,0,1,144,160Z" />
                </svg>
              )}
            </button>
          </div>
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

        <div className={styles.field}>
          <label className={styles.checkRow} htmlFor="signup-terms">
            <input
              id="signup-terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => setAcceptTerms(event.target.checked)}
              aria-invalid={Boolean(errors.acceptTerms)}
              aria-describedby={
                errors.acceptTerms ? "signup-terms-error" : undefined
              }
            />
            <span>
              J’accepte les{" "}
              <Link href="/legal/cgu" className={styles.inlineLink}>
                CGU
              </Link>{" "}
              et la{" "}
              <Link href="/legal/privacy" className={styles.inlineLink}>
                politique de confidentialité
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms ? (
            <p id="signup-terms-error" className={styles.error} role="alert">
              {errors.acceptTerms}
            </p>
          ) : null}
        </div>

        {errors.form ? (
          <p className={styles.error} role="alert">
            {errors.form}
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={submitting || googleLoading}>
          {submitting ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <AuthDivider />

      <GoogleSignInButton
        onClick={handleGoogleSignUp}
        loading={googleLoading}
        disabled={submitting}
      />

      <p className={styles.switch}>
        Déjà un compte ?{" "}
        <Link href="/login" className={styles.switchLink}>
          Se connecter
        </Link>
      </p>
    </>
  );
}
