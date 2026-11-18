/**
 * Vues de la page d’authentification unique (`/login`) : connexion, code
 * d’invitation, création de compte. La vue affichée vit dans `?vue=` pour
 * que les liens (landing, invitations, `/signup`, `/join`) ouvrent la bonne
 * carte du carrousel sans changer de page.
 */

export const AUTH_VIEWS = ["code", "login", "signup"] as const;

export type AuthView = (typeof AUTH_VIEWS)[number];

/** Paramètre d’URL portant la vue affichée. */
export const AUTH_VIEW_PARAM = "vue";

/** Chemin de la page d’authentification unique. */
export const AUTH_PAGE_PATH = "/login";

/** Vue lue depuis `?vue=` ; connexion par défaut. */
export function parseAuthView(value: string | null | undefined): AuthView {
  return AUTH_VIEWS.find((view) => view === value) ?? "login";
}

type AuthHrefOptions = {
  /** Page à rouvrir après authentification (`next`). */
  next?: string | null;
  /** Intent d’inscription (`founder`). */
  intent?: string | null;
};

/** URL de la page d’authentification ouverte sur `view`. */
export function authHref(view: AuthView, options: AuthHrefOptions = {}): string {
  const params = new URLSearchParams();
  if (view !== "login") params.set(AUTH_VIEW_PARAM, view);
  if (options.intent) params.set("intent", options.intent);
  if (options.next) params.set("next", options.next);
  const query = params.toString();
  return query ? `${AUTH_PAGE_PATH}?${query}` : AUTH_PAGE_PATH;
}

/**
 * Query string conservant tous les paramètres de `search` avec la vue
 * remplacée (utilisée pour réécrire l’URL quand le carrousel tourne).
 */
export function withAuthView(search: string, view: AuthView): string {
  const params = new URLSearchParams(search);
  if (view === "login") {
    params.delete(AUTH_VIEW_PARAM);
  } else {
    params.set(AUTH_VIEW_PARAM, view);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Vue voisine dans l’ordre circulaire du carrousel (code ← login → signup).
 * `step` = +1 pour la droite, -1 pour la gauche.
 */
export function neighbourAuthView(view: AuthView, step: 1 | -1): AuthView {
  const index = AUTH_VIEWS.indexOf(view);
  const length = AUTH_VIEWS.length;
  return AUTH_VIEWS[(index + step + length) % length];
}

/** Carte « Créer un compte » en parcours fondateur (CTA de la landing). */
export const FOUNDER_SIGNUP_HREF = authHref("signup", { intent: "founder" });
