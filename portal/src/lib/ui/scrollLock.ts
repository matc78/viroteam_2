/**
 * Blocage du défilement de la page sous une modale. Compteur partagé :
 * des modales empilées ne débloquent la page qu’à la fermeture de la
 * dernière. La place de la barre de défilement est gardée
 * (`scrollbar-gutter: stable`, sinon un `padding-right` équivalent) pour
 * que la page ne bouge pas.
 */

/** Élément qui défile (`document.documentElement` dans le portail). */
type ScrollRoot = {
  style: { overflow: string; paddingRight: string; scrollbarGutter: string };
  clientWidth: number;
};

type LockState = {
  count: number;
  overflow: string;
  paddingRight: string;
  scrollbarGutter: string;
};

/** Options de [lockScroll]. */
type LockScrollOptions = {
  /**
   * Le navigateur gère `scrollbar-gutter` : la gouttière reste réservée,
   * la largeur du viewport ne change pas (les éléments `fixed` ne bougent
   * pas). Sinon, compensation par `padding-right`.
   */
  stableGutter?: boolean;
};

const locks = new WeakMap<ScrollRoot, LockState>();

/**
 * Bloque le défilement de [root] ; [viewportWidth] sert à mesurer la barre
 * de défilement à compenser. Retourne la fonction qui libère ce verrou
 * (sans effet si appelée deux fois).
 */
export function lockScroll(
  root: ScrollRoot,
  viewportWidth: number,
  options: LockScrollOptions = {},
): () => void {
  const existing = locks.get(root);
  if (existing) {
    existing.count += 1;
  } else {
    const scrollbarWidth = Math.max(
      0,
      Math.round(viewportWidth - root.clientWidth),
    );
    locks.set(root, {
      count: 1,
      overflow: root.style.overflow,
      paddingRight: root.style.paddingRight,
      scrollbarGutter: root.style.scrollbarGutter,
    });
    if (options.stableGutter) {
      root.style.scrollbarGutter = "stable";
    } else if (scrollbarWidth > 0) {
      root.style.paddingRight = `${scrollbarWidth}px`;
    }
    root.style.overflow = "hidden";
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const state = locks.get(root);
    if (!state) return;
    state.count -= 1;
    if (state.count > 0) return;
    root.style.overflow = state.overflow;
    root.style.paddingRight = state.paddingRight;
    root.style.scrollbarGutter = state.scrollbarGutter;
    locks.delete(root);
  };
}

/** Zones qui gardent leur défilement sous une modale (listes portées hors du dialog). */
const SCROLLABLE_OVERLAY_SELECTOR = '[role="dialog"], [role="listbox"], [role="menu"]';

/**
 * Vrai si un geste de défilement sur [target] doit rester possible pendant
 * qu’une modale ([dialogRoot]) est ouverte : dans la modale, ou dans une
 * liste / un menu porté hors d’elle. Ailleurs (fond, page pleine hauteur qui
 * défile dans un conteneur interne), il est bloqué.
 */
export function isScrollAllowedUnderModal(
  target: EventTarget | null,
  dialogRoot: Node,
): boolean {
  if (!(target instanceof Node)) return false;
  if (dialogRoot.contains(target)) return true;
  const element = target instanceof Element ? target : target.parentElement;
  return Boolean(element?.closest(SCROLLABLE_OVERLAY_SELECTOR));
}
