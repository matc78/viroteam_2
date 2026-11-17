import { randomInt } from "node:crypto";

/**
 * Codes d'invitation (fonctions pures, testables avec `node --test`).
 *
 * Revue sécurité (17 nov. 2026) : les codes sont tirés avec un générateur
 * cryptographique (`crypto.randomInt`, sans biais de modulo) et non plus
 * `Math.random()`, prévisible ; l'unicité parmi les invitations `pending` est
 * vérifiée avant écriture (`inviteCodes.ts`).
 */

/** Alphabet sans caractères ambigus (0/O, 1/I/L). */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Longueur par défaut d'un code d'invitation. */
export const INVITE_CODE_LENGTH = 6;

/** Tirages max avant d'abandonner (collision improbable : 32^6 ≈ 1 milliard). */
export const INVITE_CODE_MAX_ATTEMPTS = 8;

/**
 * Tire un code de [length] caractères de [INVITE_CODE_ALPHABET].
 * [pickIndex] (borne exclusive → index) est injectable pour les tests.
 */
export function generateInviteCode(
  length = INVITE_CODE_LENGTH,
  pickIndex: (max: number) => number = (max) => randomInt(max),
): string {
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += INVITE_CODE_ALPHABET[pickIndex(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Tire des codes jusqu'à en trouver un que [isTaken] déclare libre.
 * Lève une erreur après [maxAttempts] collisions.
 */
export async function generateUniqueInviteCode(params: {
  isTaken: (code: string) => Promise<boolean>;
  generate?: () => string;
  maxAttempts?: number;
}): Promise<string> {
  const generate = params.generate ?? (() => generateInviteCode());
  const maxAttempts = params.maxAttempts ?? INVITE_CODE_MAX_ATTEMPTS;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generate();
    if (!(await params.isTaken(code))) return code;
  }
  throw new Error("Impossible de générer un code d'invitation unique");
}
