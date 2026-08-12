"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { JoinAppRedirect } from "@/components/auth/JoinAppRedirect";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { findInvitationByCode } from "@/lib/firebase/invitationService";
import type { InvitationLookupResult } from "@/lib/firebase/invitationService";
import { splitDisplayName } from "@/lib/firebase/types";
import { updateUserProfileForJoin } from "@/lib/firebase/userService";
import formStyles from "./AuthForm.module.css";
import styles from "./JoinOnboardingForm.module.css";

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  code?: string;
  form?: string;
};

type JoinOnboardingFormProps = {
  onCompleted: (params: { clubName: string; code: string }) => void;
};

/** Formulaire profil + code club (aligné inscription join de l’app). */
export function JoinOnboardingForm({ onCompleted }: JoinOnboardingFormProps) {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");
  const [clubPreview, setClubPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const cachedInvitationRef = useRef<{
    code: string;
    invitation: InvitationLookupResult;
  } | null>(null);

  useEffect(() => {
    const fromProfileFirst = profile?.firstName?.trim();
    const fromProfileLast = profile?.lastName?.trim();
    if (fromProfileFirst) setFirstName(fromProfileFirst);
    if (fromProfileLast) setLastName(fromProfileLast);

    if (!fromProfileFirst && profile?.displayName) {
      const split = splitDisplayName(profile.displayName);
      if (split.firstName) setFirstName(split.firstName);
      if (split.lastName) setLastName(split.lastName);
    }
  }, [profile]);

  async function lookupCode(rawCode: string): Promise<boolean> {
    const normalizedCode = rawCode.trim().toUpperCase();
    const cached = cachedInvitationRef.current;
    const invitation =
      cached?.code === normalizedCode
        ? cached.invitation
        : await findInvitationByCode(normalizedCode);

    if (!invitation) {
      if (cached?.code === normalizedCode) cachedInvitationRef.current = null;
      setClubPreview(null);
      return false;
    }

    cachedInvitationRef.current = { code: normalizedCode, invitation };
    setClubPreview(invitation.clubName);
    if (!firstName.trim() && invitation.firstName) {
      setFirstName(invitation.firstName);
    }
    if (!lastName.trim() && invitation.lastName) {
      setLastName(invitation.lastName);
    }
    return true;
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!firstName.trim() || firstName.trim().length < 2) {
      next.firstName = "Prénom requis (2 caractères minimum).";
    }
    if (!lastName.trim() || lastName.trim().length < 2) {
      next.lastName = "Nom requis (2 caractères minimum).";
    }
    if (!code.trim()) {
      next.code = "Le code d’invitation est requis.";
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!user?.email) {
      setErrors({ form: "Session invalide. Reconnecte-toi." });
      return;
    }

    setSubmitting(true);
    setErrors({});

    try {
      const normalizedCode = code.trim().toUpperCase();
      const cached = cachedInvitationRef.current;
      const invitation =
        cached?.code === normalizedCode
          ? cached.invitation
          : await findInvitationByCode(normalizedCode);
      if (!invitation) {
        setClubPreview(null);
        setErrors({ code: "Code introuvable ou expiré." });
        return;
      }

      await updateUserProfileForJoin({
        uid: user.uid,
        email: user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      await refreshProfile();
      onCompleted({ clubName: invitation.clubName, code: normalizedCode });
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "Impossible d’enregistrer ton profil.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeBlur() {
    const normalized = code.trim();
    if (normalized.length < 4) {
      setClubPreview(null);
      return;
    }
    await lookupCode(normalized);
  }

  return (
    <form className={styles.joinForm} onSubmit={handleSubmit} noValidate>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor="join-first-name">
          Prénom
        </label>
        <input
          id="join-first-name"
          className={`${formStyles.input}${errors.firstName ? ` ${formStyles.inputInvalid}` : ""}`}
          type="text"
          name="firstName"
          autoComplete="given-name"
          placeholder="Tristan"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
        />
        {errors.firstName ? (
          <p className={formStyles.error} role="alert">
            {errors.firstName}
          </p>
        ) : null}
      </div>

      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor="join-last-name">
          Nom
        </label>
        <input
          id="join-last-name"
          className={`${formStyles.input}${errors.lastName ? ` ${formStyles.inputInvalid}` : ""}`}
          type="text"
          name="lastName"
          autoComplete="family-name"
          placeholder="Heraud"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
        />
        {errors.lastName ? (
          <p className={formStyles.error} role="alert">
            {errors.lastName}
          </p>
        ) : null}
      </div>

      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor="join-code">
          Code d’invitation
        </label>
        <input
          id="join-code"
          className={`${formStyles.input}${errors.code ? ` ${formStyles.inputInvalid}` : ""}`}
          type="text"
          name="code"
          autoComplete="off"
          placeholder="Ex. ASMP1K2E"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onBlur={() => void handleCodeBlur()}
        />
        {errors.code ? (
          <p className={formStyles.error} role="alert">
            {errors.code}
          </p>
        ) : null}
        {clubPreview ? (
          <p className={styles.clubPreview} role="status">
            Club trouvé : <strong>{clubPreview}</strong>
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <p className={formStyles.error} role="alert">
          {errors.form}
        </p>
      ) : null}

      <button
        className={formStyles.submit}
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Enregistrement…" : "Continuer vers l’app"}
      </button>
    </form>
  );
}

type JoinOnboardingSuccessProps = {
  firstName: string;
  clubName: string;
  code: string;
};

/** Écran de succès avec ouverture de l’app et code club. */
export function JoinOnboardingSuccess({
  firstName,
  clubName,
  code,
}: JoinOnboardingSuccessProps) {
  const displayFirstName = firstName.trim() || "champion";

  return (
    <JoinAppRedirect
      code={code}
      clubName={clubName}
      successMessage={
        <>
          C’est bon {displayFirstName} ! Ton profil est prêt pour rejoindre{" "}
          <strong>{clubName}</strong>. Ouvre l’app ViroTeam pour valider ton
          invitation.
        </>
      }
    />
  );
}
