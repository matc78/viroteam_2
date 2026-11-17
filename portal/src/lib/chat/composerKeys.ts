/** Sous-ensemble d’un `KeyboardEvent` utile au composer (testable sans DOM). */
export type ComposerKeyEvent = {
  key: string;
  shiftKey: boolean;
  /** `KeyboardEvent.isComposing` (composition IME en cours). */
  isComposing?: boolean;
  /** Legacy : 229 pendant une composition IME (Safari, certains claviers). */
  keyCode?: number;
};

/** Code clavier émis par les navigateurs pendant une composition IME. */
const IME_PROCESS_KEY_CODE = 229;

/** True si la touche est tapée pendant une composition IME (accents, kana…). */
export function isImeComposing(event: ComposerKeyEvent): boolean {
  return Boolean(event.isComposing) || event.keyCode === IME_PROCESS_KEY_CODE;
}

/**
 * True si la touche doit valider le composer : Entrée sans Maj, hors
 * composition IME (l’Entrée qui valide un caractère composé ne doit pas
 * envoyer le message).
 */
export function shouldSubmitOnEnter(event: ComposerKeyEvent): boolean {
  return event.key === "Enter" && !event.shiftKey && !isImeComposing(event);
}

/** True si le brouillon contient autre chose que des espaces. */
export function hasSendableText(draft: string): boolean {
  return draft.trim().length > 0;
}
