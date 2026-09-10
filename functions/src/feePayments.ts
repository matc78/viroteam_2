import * as admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { db } from "./db";

const RECEIPT_SIGNED_URL_TTL_MS = 60 * 60 * 1000;

export type FeePaymentProvider = "helloasso" | "stripe";

/** Libellé d'aide déclaré au checkout. */
export function aidLabel(type: string): string {
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

/**
 * Crédite une cotisation après confirmation serveur (webhook).
 * Idempotent via `appliedExternalPaymentIds`.
 */
export async function creditMemberFeeFromCardPayment(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  sessionId: string;
  amountCents: number;
  externalPaymentId: string;
  externalOrderId?: string;
  provider: FeePaymentProvider;
}): Promise<{ status: string; creditedCents: number }> {
  const {
    clubId,
    seasonId,
    memberId,
    sessionId,
    amountCents,
    externalPaymentId,
    externalOrderId,
    provider,
  } = params;

  if (!externalPaymentId.trim()) {
    throw new Error("externalPaymentId missing");
  }

  const feeRef = db()
    .collection("clubs")
    .doc(clubId)
    .collection("fee_seasons")
    .doc(seasonId)
    .collection("member_fees")
    .doc(memberId);

  let nextStatus = "a_payer";
  let creditedCents = 0;

  await db().runTransaction(async (tx) => {
    const feeSnap = await tx.get(feeRef);
    if (!feeSnap.exists) {
      throw new Error("fee missing");
    }
    const fee = feeSnap.data()!;

    const appliedIds =
      (fee.appliedExternalPaymentIds as string[] | undefined) ?? [];
    if (appliedIds.includes(externalPaymentId)) {
      nextStatus = String(fee.status ?? "a_payer");
      creditedCents = 0;
      return;
    }

    const seasonSnap = await tx.get(
      db()
        .collection("clubs")
        .doc(clubId)
        .collection("fee_seasons")
        .doc(seasonId),
    );
    const season = seasonSnap.data() ?? {};
    const tiers =
      (season.tiers as { tierId: string; amountCents: number }[]) ?? [];
    const tier = tiers.find((t) => t.tierId === fee.tierId);
    const due = fee.status === "exonere" ? 0 : (tier?.amountCents ?? 0);

    const previousPaid = Number(fee.amountPaidCents ?? 0);
    let credit = amountCents;
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

    creditedCents = Math.max(0, credit);
    const newPaid = previousPaid + creditedCents;
    const aids =
      (fee.aids as { status: string; amountCents: number }[]) ?? [];
    const validatedAids = aids
      .filter((a) => a.status === "validated")
      .reduce((s, a) => s + Number(a.amountCents ?? 0), 0);
    const pendingAids = aids.some((a) => a.status === "pending_proof");
    const remaining = due - (newPaid + validatedAids);

    if (remaining <= 0 && !pendingAids) {
      nextStatus = "paye";
    } else if (newPaid > 0 || validatedAids > 0 || pendingAids) {
      nextStatus = "partiel";
    } else {
      nextStatus = "a_payer";
    }

    tx.set(
      feeRef,
      {
        amountPaidCents: newPaid,
        status: nextStatus,
        paidVia: provider,
        paymentProvider: provider,
        externalPaymentId,
        externalOrderId: externalOrderId ?? null,
        appliedExternalPaymentIds: [...appliedIds, externalPaymentId],
        paidAt:
          nextStatus === "paye"
            ? admin.firestore.FieldValue.serverTimestamp()
            : (fee.paidAt ?? null),
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
          lastExternalPaymentId: externalPaymentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  });

  return { status: nextStatus, creditedCents };
}

/**
 * Génère un PDF de reçu, le stocke en privé, et renvoie une URL signée (1 h).
 */
export async function generateAndStoreReceipt(params: {
  clubId: string;
  seasonId: string;
  memberId: string;
  amountCents: number;
  externalPaymentId: string;
  providerLabel?: string;
}): Promise<string | null> {
  const {
    clubId,
    seasonId,
    memberId,
    amountCents,
    externalPaymentId,
    providerLabel = "encaissement confirmé",
  } = params;

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
    providerLabel,
  });

  const path = `receipts/${clubId}/${seasonId}/${memberId}_${Date.now()}.pdf`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  await file.save(pdfBuffer, {
    contentType: "application/pdf",
    metadata: { cacheControl: "private, max-age=3600" },
  });

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + RECEIPT_SIGNED_URL_TTL_MS,
  });
  return url;
}

function buildReceiptPdf(input: {
  clubName: string;
  memberName: string;
  amountLabel: string;
  paymentId: string;
  paidAt: Date;
  providerLabel: string;
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
      `Document généré automatiquement suite à un ${input.providerLabel}.`,
      { width: 480 },
    );
    doc.end();
  });
}
