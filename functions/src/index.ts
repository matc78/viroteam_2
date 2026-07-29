import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";

admin.initializeApp();
setGlobalOptions({ region: "europe-west1" });

const db = () => admin.firestore();

/**
 * Accepte une invitation (à brancher depuis le client à la place de l'update direct).
 * Corps : { clubId, invitationId }
 */
export const acceptInvitation = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Connexion requise");
  }
  const clubId = request.data?.clubId as string | undefined;
  const invitationId = request.data?.invitationId as string | undefined;
  if (!clubId || !invitationId) {
    throw new HttpsError("invalid-argument", "clubId et invitationId requis");
  }

  const inviteRef = db()
    .collection("clubs")
    .doc(clubId)
    .collection("invitations")
    .doc(invitationId);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "Invitation introuvable");
  }
  const invite = inviteSnap.data()!;
  if (invite.status !== "pending") {
    throw new HttpsError("failed-precondition", "Invitation déjà traitée");
  }

  await inviteRef.update({
    status: "accepted",
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptedBy: request.auth.uid,
  });

  return { ok: true };
});

/**
 * Webhook paiement (prestataire à brancher).
 * Marque la cotisation payée via Admin SDK uniquement.
 *
 * Attendu (exemple) : clubId, seasonId, memberId, externalPaymentId
 */
export const paymentWebhook = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  // TODO: vérifier la signature du prestataire (Stripe, etc.)
  const { clubId, seasonId, memberId, externalPaymentId, provider } =
    req.body ?? {};
  if (!clubId || !seasonId || !memberId) {
    res.status(400).json({ error: "Paramètres manquants" });
    return;
  }

  const feeRef = db()
    .collection("clubs")
    .doc(String(clubId))
    .collection("fee_seasons")
    .doc(String(seasonId))
    .collection("member_fees")
    .doc(String(memberId));

  await feeRef.set(
    {
      status: "paye",
      paidVia: "in_app",
      paymentProvider: provider ?? "unknown",
      externalPaymentId: externalPaymentId ?? null,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  res.json({ ok: true });
});
