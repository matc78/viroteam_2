/** Route de la page Messagerie, par espace. */
const BUREAU_MESSAGES_PATH = "/messages";
const FAMILY_MESSAGES_PATH = "/family/messages";

function isPathOrChild(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** True si la route est la page Messagerie du bureau (`/messages`). */
export function isBureauMessagesPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return isPathOrChild(pathname, BUREAU_MESSAGES_PATH);
}

/** True si la route est la page Messagerie de l’espace famille (`/family/messages`). */
export function isFamilyMessagesPath(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return isPathOrChild(pathname, FAMILY_MESSAGES_PATH);
}

/** True si la route courante est la page Messagerie (bureau ou famille). */
export function isMessagesPath(pathname: string | null | undefined): boolean {
  return isBureauMessagesPath(pathname) || isFamilyMessagesPath(pathname);
}
