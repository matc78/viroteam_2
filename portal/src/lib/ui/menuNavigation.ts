/**
 * Index de l’item à focaliser après une touche dans un menu (`role="menu"`) :
 * flèches haut / bas en boucle, Début / Fin. `null` = touche non gérée.
 *
 * @param current index de l’item focalisé (-1 si aucun).
 * @param count nombre d’items actifs du menu.
 */
export function nextMenuIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowDown":
      return current < 0 ? 0 : (current + 1) % count;
    case "ArrowUp":
      return current < 0 ? count - 1 : (current - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
