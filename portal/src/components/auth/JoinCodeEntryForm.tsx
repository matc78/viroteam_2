"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { joinCopy } from "@/lib/copy/joinCopy";
import formStyles from "./AuthForm.module.css";

/** Saisie d’un code d’invitation avant compte (Espace club). */
export function JoinCodeEntryForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError(joinCopy.enterCodeRequired);
      return;
    }
    if (normalized.length < 4) {
      setError(joinCopy.enterCodeTooShort);
      return;
    }
    setError(null);
    router.replace(`/join?code=${encodeURIComponent(normalized)}`);
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
      <div className={formStyles.field}>
        <label className={formStyles.label} htmlFor="join-entry-code">
          {joinCopy.enterCodeLabel}
        </label>
        <input
          id="join-entry-code"
          className={`${formStyles.input}${error ? ` ${formStyles.inputInvalid}` : ""}`}
          type="text"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={joinCopy.enterCodePlaceholder}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "join-entry-code-error" : undefined}
        />
        {error ? (
          <p id="join-entry-code-error" className={formStyles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <button className={formStyles.submit} type="submit">
        {joinCopy.enterCodeSubmit}
      </button>
    </form>
  );
}
