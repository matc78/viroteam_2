import * as admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { db, defineDualCallable, defineDualRequest } from "./db";
import { assertCanActForMember } from "./guardians";

export {
  inviteGuardian,
  inviteGuardianDev,
  linkGuardian,
  linkGuardianDev,
  revokeGuardian,
  revokeGuardianDev,
  updateGuardianInviteEmail,
  updateGuardianInviteEmailDev,
  extendGuardianInvite,
  extendGuardianInviteDev,
  regenerateGuardianInvite,
  regenerateGuardianInviteDev,
  setEventRsvp,
  setEventRsvpDev,
} from "./guardians";

export { sendMemberInvites, sendMemberInvitesDev } from "./memberInvites";

export {
  acceptInvitation,
  acceptInvitationDev,
} from "./acceptInvitation";

const helloAssoClientId = defineSecret("HELLOASSO_CLIENT_ID");
const helloAssoClientSecret = defineSecret("HELLOASSO_CLIENT_SECRET");
const helloAssoApiBase = defineString("HELLOASSO_API_BASE", {
  default: "https://api.helloasso.com",
});

type AidInput = {
  type: string;
  amountCents: number;
  promoCode?: string;
  label?: string;
};

type TokenCache = {
  accessToken: string;
  refreshToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

/**
 * Crée un checkout HelloAsso (1× ou 3×) après application des aides déclarées.
 * Ne marque jamais la cotisation payée — réservé au webhook.
 * Prod → v2-prod ; `createHelloAssoCheckoutDev` → v2-dev.
 */
export const {
  prod: createHelloAssoCheckout,
  dev: createHelloAssoCheckoutDev,
} = defineDualCallable(
  { secrets: [helloAssoClientId, helloAssoClientSecret] },
  async (request: CallableRequest) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Connexion requise");
    }

    const clubId = request.data?.clubId as string | undefined;
    const seasonId = request.data?.seasonId as string | undefined;
    const memberId = request.data?.memberId as string | undefined;
    const amountCents = Number(request.data?.amountCents ?? 0);
    const installmentCount = Number(request.data?.installmentCount ?? 1);
    const aids = (request.data?.aids as AidInput[] | undefined) ?? [];
    const returnUrl =
      (request.data?.returnUrl as string | undefined) ??
      "https://viroteam.app/payment/return";
    const backUrl =
      (request.data?.backUrl as string | undefined) ?? returnUrl;
    const errorUrl =
      (request.data?.errorUrl as string | undefined) ?? returnUrl;

    const callerUid = request.auth?.uid;
    if (!callerUid) {
      throw new HttpsError("unauthenticated", "Connexion requise");
    }
    if (!clubId || !seasonId || !memberId) {
      throw new HttpsError(
        "invalid-argument",
        "clubId, seasonId et memberId requis",
      );
    }

    await assertCanActForMember({
      clubId,
      memberId,
      uid: callerUid,
      permission: "canPay",
    });

    if (amountCents < 0) {
      throw new HttpsError("invalid-argument", "Montant invalide");
    }
    if (installmentCount !== 1 && installmentCount !== 3) {
      throw new HttpsError(
        "invalid-argument",
        "installmentCount doit être 1 ou 3",
      );
    }

    const clubSnap = await db().collection("clubs").doc(clubId).get();
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", "Club introuvable");
    }
    const club = clubSnap.data()!;
    const orgSlug = club.helloAssoOrganizationSlug as string | undefined;
    if (!orgSlug) {
      throw new HttpsError(
        "failed-precondition",
        "Slug HelloAsso du club manquant (helloAssoOrganizationSlug)",
      );
    }

    const feeRef = db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("member_fees")
      .doc(memberId);
    const feeSnap = await feeRef.get();
    if (!feeSnap.exists) {
      throw new HttpsError("not-found", "Cotisation introuvable");
    }

    const sessionRef = db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("payment_sessions")
      .doc();

    const now = admin.firestore.Timestamp.now();
    const aidDocs = aids
      .filter((a) => a.amountCents > 0)
      .map((a, index) => ({
        id: `${sessionRef.id}_${index}`,
        type: a.type || "other",
        label: a.label || aidLabel(a.type || "other"),
        amountCents: Math.round(a.amountCents),
        status: "pending_proof",
        promoCode: a.promoCode ?? null,
        createdAt: now,
      }));

    const cardAmount = Math.round(amountCents);
    if (cardAmount <= 0) {
      // Aides seules : on enregistre les justificatifs sans checkout CB.
      const existingAids =
        (feeSnap.data()?.aids as Record<string, unknown>[] | undefined) ?? [];
      await feeRef.set(
        {
          aids: [...existingAids, ...aidDocs],
          status: "partiel",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return {
        ok: true,
        sessionId: sessionRef.id,
        redirectUrl: null,
        message: "Aides enregistrées — en attente de justificatif",
      };
    }

    const { initialAmount, terms } = buildInstallmentPlan(
      cardAmount,
      installmentCount,
    );

    const accessToken = await getHelloAssoAccessToken();
    const itemName = `Cotisation ${club.name ?? clubId}`.slice(0, 250);

    const checkoutBody: Record<string, unknown> = {
      totalAmount: cardAmount,
      initialAmount,
      itemName,
      backUrl,
      errorUrl,
      returnUrl,
      containsDonation: false,
      metadata: {
        sessionId: sessionRef.id,
        clubId,
        seasonId,
        memberId,
        provider: "helloasso",
      },
    };
    if (terms.length > 0) {
      checkoutBody.terms = terms;
    }

    const checkoutRes = await fetch(
      `${helloAssoApiBase.value()}/v5/organizations/${encodeURIComponent(orgSlug)}/checkout-intents`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(checkoutBody),
      },
    );

    if (!checkoutRes.ok) {
      const errText = await checkoutRes.text();
      throw new HttpsError(
        "internal",
        `HelloAsso checkout échoué (${checkoutRes.status}): ${errText.slice(0, 300)}`,
      );
    }

    const checkoutJson = (await checkoutRes.json()) as {
      id?: number | string;
      redirectUrl?: string;
    };

    if (!checkoutJson.redirectUrl) {
      throw new HttpsError(
        "internal",
        "HelloAsso n'a pas renvoyé redirectUrl",
      );
    }

    await sessionRef.set({
      clubId,
      seasonId,
      memberId,
      amountCents: cardAmount,
      installmentCount,
      aids: aidDocs,
      status: "pending",
      checkoutIntentId: String(checkoutJson.id ?? ""),
      createdBy: request.auth.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const existingAids =
      (feeSnap.data()?.aids as Record<string, unknown>[] | undefined) ?? [];
    await feeRef.set(
      {
        aids: aidDocs.length > 0 ? [...existingAids, ...aidDocs] : existingAids,
        checkoutIntentId: String(checkoutJson.id ?? ""),
        installmentCount,
        paymentProvider: "helloasso",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return {
      ok: true,
      sessionId: sessionRef.id,
      checkoutIntentId: String(checkoutJson.id ?? ""),
      redirectUrl: checkoutJson.redirectUrl,
    };
  },
);

/**
 * Webhook HelloAsso — seule source de vérité pour marquer un paiement CB.
 * Configurer l'URL dans Mon Compte > Intégrations et API (Order + Payment).
 * Prod → v2-prod ; `helloAssoWebhookDev` → v2-dev.
 */
export const {
  prod: helloAssoWebhook,
  dev: helloAssoWebhookDev,
} = defineDualRequest(
  { secrets: [helloAssoClientId, helloAssoClientSecret] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      const eventType = String(
        req.body?.eventType ?? req.body?.data?.eventType ?? "",
      );
      const data = (req.body?.data ?? req.body ?? {}) as Record<
        string,
        unknown
      >;

      // Accepter Order (commande créée) et Payment (paiement autorisé).
      if (eventType && eventType !== "Order" && eventType !== "Payment") {
        res.json({ ok: true, ignored: eventType });
        return;
      }

      const metadata =
        (data.metadata as Record<string, unknown> | undefined) ??
        ((data.order as Record<string, unknown> | undefined)?.metadata as
          | Record<string, unknown>
          | undefined) ??
        {};

      const clubId = String(metadata.clubId ?? "");
      const seasonId = String(metadata.seasonId ?? "");
      const memberId = String(metadata.memberId ?? "");
      const sessionId = String(metadata.sessionId ?? "");

      if (!clubId || !seasonId || !memberId) {
        // Fallback : retrouver via checkoutIntentId / session
        res.status(200).json({
          ok: true,
          warning: "metadata incomplete — ignored",
        });
        return;
      }

      const paymentState = String(
        data.state ?? data.paymentState ?? "",
      ).toLowerCase();
      // HelloAsso : Authorized / AuthorizedWaitingBankValidation / etc.
      const isAuthorized =
        !paymentState ||
        paymentState.includes("authoriz") ||
        eventType === "Order";

      if (!isAuthorized) {
        res.json({ ok: true, ignoredState: paymentState });
        return;
      }

      const amount =
        Number(data.amount ?? data.cashOutAmount ?? data.totalAmount ?? 0) ||
        0;
      const externalPaymentId = String(
        data.id ?? data.paymentId ?? data.orderId ?? "",
      );
      const orderObj = data.order as Record<string, unknown> | undefined;
      const externalOrderId = String(
        orderObj?.id ?? data.orderId ?? data.id ?? "",
      );

      const feeRef = db()
        .collection("clubs")
        .doc(clubId)
        .collection("fee_seasons")
        .doc(seasonId)
        .collection("member_fees")
        .doc(memberId);

      await db().runTransaction(async (tx) => {
        const feeSnap = await tx.get(feeRef);
        if (!feeSnap.exists) {
          throw new Error("fee missing");
        }
        const fee = feeSnap.data()!;

        const appliedIds =
          (fee.appliedExternalPaymentIds as string[] | undefined) ?? [];
        if (externalPaymentId && appliedIds.includes(externalPaymentId)) {
          return; // idempotent
        }

        const seasonSnap = await tx.get(
          db()
            .collection("clubs")
            .doc(clubId)
            .collection("fee_seasons")
            .doc(seasonId),
        );
        const season = seasonSnap.data() ?? {};
        const tiers = (season.tiers as { tierId: string; amountCents: number }[]) ?? [];
        const tier = tiers.find((t) => t.tierId === fee.tierId);
        const due = fee.status === "exonere" ? 0 : (tier?.amountCents ?? 0);

        const previousPaid = Number(fee.amountPaidCents ?? 0);
        // Sur Order : créditer le montant de session si amount absent.
        let credit = amount;
        if (credit <= 0 && sessionId) {
          const sessionSnap = await tx.get(
            db()
              .collection("clubs")
              .doc(clubId)
              .collection("fee_seasons")
              .doc(seasonId)
              .collection("payment_sessions")
              .doc(sessionId),
          );
          credit = Number(sessionSnap.data()?.amountCents ?? 0);
        }

        // Pour un plan 3×, chaque Payment crédite son échéance.
        const newPaid = previousPaid + Math.max(0, credit);
        const aids = (fee.aids as { status: string; amountCents: number }[]) ?? [];
        const validatedAids = aids
          .filter((a) => a.status === "validated")
          .reduce((s, a) => s + Number(a.amountCents ?? 0), 0);
        const pendingAids = aids.some((a) => a.status === "pending_proof");
        const remaining = due - (newPaid + validatedAids);

        let nextStatus = "a_payer";
        if (remaining <= 0 && !pendingAids) {
          nextStatus = "paye";
        } else if (newPaid > 0 || validatedAids > 0 || pendingAids) {
          nextStatus = "partiel";
        }

        tx.set(
          feeRef,
          {
            amountPaidCents: newPaid,
            status: nextStatus,
            paidVia: "helloasso",
            paymentProvider: "helloasso",
            externalPaymentId: externalPaymentId || null,
            externalOrderId: externalOrderId || null,
            appliedExternalPaymentIds: externalPaymentId
              ? [...appliedIds, externalPaymentId]
              : appliedIds,
            paidAt:
              nextStatus === "paye"
                ? admin.firestore.FieldValue.serverTimestamp()
                : fee.paidAt ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        if (sessionId) {
          const sessionRef = db()
            .collection("clubs")
            .doc(clubId)
            .collection("fee_seasons")
            .doc(seasonId)
            .collection("payment_sessions")
            .doc(sessionId);
          tx.set(
            sessionRef,
            {
              status: nextStatus === "paye" ? "completed" : "partial",
              lastExternalPaymentId: externalPaymentId || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      });

      // Reçu PDF (best-effort, hors transaction).
      try {
        const receiptUrl = await generateAndStoreReceipt({
          clubId,
          seasonId,
          memberId,
          amountCents: amount,
          externalPaymentId,
        });
        if (receiptUrl) {
          await feeRef.set({ receiptUrl }, { merge: true });
        }
      } catch (e) {
        console.error("receipt generation failed", e);
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("helloAssoWebhook error", e);
      res.status(500).json({ error: "webhook failed" });
    }
  },
);

/** @deprecated Utiliser [helloAssoWebhook]. Conservé pour compat déploiement. */
export const paymentWebhook = helloAssoWebhook;

function aidLabel(type: string): string {
  switch (type) {
    case "pass_sport":
      return "Pass'Sport";
    case "pass_plus":
      return "Pass+";
    case "ancv":
      return "Chèques ANCV";
    case "promo":
      return "Code promo";
    default:
      return "Autre aide";
  }
}

/** Construit initialAmount + terms pour 1× ou 3× (contraintes HelloAsso). */
function buildInstallmentPlan(
  totalCents: number,
  installmentCount: number,
): {
  initialAmount: number;
  terms: { amount: number; date: string }[];
} {
  if (installmentCount === 1) {
    return { initialAmount: totalCents, terms: [] };
  }

  const a = Math.floor(totalCents / 3);
  const b = Math.floor(totalCents / 3);
  const c = totalCents - a - b;

  const d1 = nextInstallmentDate(1);
  const d2 = nextInstallmentDate(2);

  return {
    initialAmount: a,
    terms: [
      { amount: b, date: formatHelloAssoDate(d1) },
      { amount: c, date: formatHelloAssoDate(d2) },
    ],
  };
}

/** Mois + n, jour plafonné à 27 (règle HelloAsso). */
function nextInstallmentDate(monthsAhead: number): Date {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + monthsAhead; // 0-based + offset
  const day = Math.min(now.getUTCDate(), 27);
  return new Date(Date.UTC(year, month, day));
}

function formatHelloAssoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getHelloAssoAccessToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken;
  }

  const tokenDoc = db().collection("_system").doc("helloasso_oauth");
  const snap = await tokenDoc.get();
  const stored = snap.data();
  if (
    stored?.refreshToken &&
    stored?.accessToken &&
    Number(stored.expiresAtMs) > now + 60_000
  ) {
    tokenCache = {
      accessToken: String(stored.accessToken),
      refreshToken: String(stored.refreshToken),
      expiresAtMs: Number(stored.expiresAtMs),
    };
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams();
  if (stored?.refreshToken) {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", String(stored.refreshToken));
  } else {
    body.set("grant_type", "client_credentials");
    body.set("client_id", helloAssoClientId.value());
    body.set("client_secret", helloAssoClientSecret.value());
  }

  let tokenRes = await fetch(`${helloAssoApiBase.value()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  // Refresh expiré → retomber sur client_credentials.
  if (!tokenRes.ok && stored?.refreshToken) {
    const fallback = new URLSearchParams();
    fallback.set("grant_type", "client_credentials");
    fallback.set("client_id", helloAssoClientId.value());
    fallback.set("client_secret", helloAssoClientSecret.value());
    tokenRes = await fetch(`${helloAssoApiBase.value()}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: fallback,
    });
  }

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new HttpsError(
      "internal",
      `OAuth HelloAsso échoué: ${text.slice(0, 200)}`,
    );
  }

  const json = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  tokenCache = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAtMs: now + json.expires_in * 1000,
  };

  await tokenDoc.set(
    {
      accessToken: tokenCache.accessToken,
      refreshToken: tokenCache.refreshToken,
      expiresAtMs: tokenCache.expiresAtMs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return tokenCache.accessToken;
}

async function generateAndStoreReceipt(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  amountCents: number;
  externalPaymentId: string;
}): Promise<string | null> {
  const { clubId, seasonId, memberId, amountCents, externalPaymentId } =
    params;

  const [clubSnap, feeSnap] = await Promise.all([
    db().collection("clubs").doc(clubId).get(),
    db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("member_fees")
      .doc(memberId)
      .get(),
  ]);

  const clubName = (clubSnap.data()?.name as string) ?? clubId;
  const memberName =
    (feeSnap.data()?.memberDisplayName as string) ?? memberId;
  const euros = (Math.max(0, amountCents) / 100).toFixed(2).replace(".", ",");

  const pdfBuffer = await buildReceiptPdf({
    clubName,
    memberName,
    amountLabel: `${euros} €`,
    paymentId: externalPaymentId || "—",
    paidAt: new Date(),
  });

  const path = `receipts/${clubId}/${seasonId}/${memberId}_${Date.now()}.pdf`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: { cacheControl: "private, max-age=3600" },
  });
  await file.makePublic().catch(() => undefined);

  // URL publique si makePublic OK, sinon signed URL 7j.
  try {
    return `https://storage.googleapis.com/${bucket.name}/${path}`;
  } catch {
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 7 * 24 * 3600 * 1000,
    });
    return url;
  }
}

function buildReceiptPdf(input: {
  clubName: string;
  memberName: string;
  amountLabel: string;
  paymentId: string;
  paidAt: Date;
}): Promise<Buffer> {
  // Lazy-load : pdfkit ralentit trop le discovery Firebase au deploy.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require("pdfkit") as typeof import("pdfkit");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Attestation de paiement", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Club : ${input.clubName}`);
    doc.text(`Adhérent : ${input.memberName}`);
    doc.text(`Montant : ${input.amountLabel}`);
    doc.text(`Référence : ${input.paymentId}`);
    doc.text(
      `Date : ${input.paidAt.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}`,
    );
    doc.moveDown();
    doc.text(
      "Document généré automatiquement suite à un encaissement confirmé (HelloAsso).",
      { width: 480 },
    );
    doc.end();
  });
}
