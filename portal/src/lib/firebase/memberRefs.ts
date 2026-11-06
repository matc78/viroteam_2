import { doc, getDoc, type DocumentReference } from "firebase/firestore";
import { getAppFirestore } from "./app";
import { Collections, Fields } from "./constants";
import { dedupeInFlight } from "./dedupeInFlight";

/**
 * « Une seule clé membre » : une fiche liée à un compte vit à
 * `members/{uid}` ; son id est la seule clé partout (rosters, RSVP,
 * guardians, cotisations, annonces, `adminIds`…). Une fiche pré-inscrite
 * garde un id aléatoire et n’a pas de compte.
 *
 * Ce module est le SEUL endroit qui construit le chemin de la fiche du
 * compte connecté (garde-fou `memberKeyUsage.test.ts`).
 */

/** Référence `clubs/{clubId}/members/{uid}` : la fiche du compte [uid]. */
export function ownMemberRef(clubId: string, uid: string): DocumentReference {
  return doc(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.members,
    uid,
  );
}

/**
 * Uid du compte lié à une fiche membre (`accountUid`, ou `userId` des fiches
 * fondateur historiques), `null` si la fiche n’est pas liée. Quand il est
 * présent, il est égal à l’id de la fiche.
 */
export function linkedAccountUid(data: Record<string, unknown>): string | null {
  const accountUid = String(data[Fields.accountUid] ?? "").trim();
  if (accountUid) return accountUid;
  return String(data[Fields.userId] ?? "").trim() || null;
}

/** Fiches « Moi » déjà trouvées (une fiche existante ne disparaît pas en session). */
const ownMemberIdCache = new Set<string>();

/** Vide le cache des fiches « Moi » (déconnexion / changement de compte). */
export function clearOwnMemberIdCache(): void {
  ownMemberIdCache.clear();
}

/**
 * Id de la fiche licencié du compte connecté dans [clubId] : `uid` si
 * `members/{uid}` existe, sinon `null` (parent seul, tiers…).
 * Résultat positif mis en cache pour la session, appels concurrents
 * mutualisés ; un « pas de fiche » est relu à chaque fois (une invitation
 * acceptée peut la créer).
 * Un refus des rules vaut « pas de fiche » : tout membre du club (= titulaire
 * de `members/{uid}`) peut lire cette fiche, donc un refus (parent seul)
 * signifie qu'elle n'existe pas.
 */
export async function getOwnMemberId(
  clubId: string,
  uid: string,
): Promise<string | null> {
  const key = `${clubId}:${uid}`;
  if (ownMemberIdCache.has(key)) return uid;
  const exists = await dedupeInFlight(`ownMember:${key}`, async () => {
    try {
      const snap = await getDoc(ownMemberRef(clubId, uid));
      return snap.exists();
    } catch (error) {
      if ((error as { code?: string })?.code === "permission-denied") return false;
      throw error;
    }
  });
  if (!exists) return null;
  ownMemberIdCache.add(key);
  return uid;
}
