import * as admin from "firebase-admin";
import {
  HttpsError,
  type CallableRequest,
  type Request,
} from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import type { Response } from "express";
import type Stripe from "stripe";
import { db, defineDualCallable, defineDualRequest, isProdDatabase } from "./db";
import { assertCanActForMember } from "./guardians";
import { assertPermission } from "./permissions";
import { PERMISSION_ADMIN } from "./permissionsCatalog";
import {
  FeeNotFoundError,
  aidLabel,
  creditMemberFeeFromCardPayment,
  generateAndStoreReceipt,
} from "./feePayments";
import {
  cardFeeCentsFromNet,
  cardGrossCentsFromNet,
} from "./stripeFees";
import { requireString, requireUid } from "./common";
import {
  boundedNetCents,
  CANCELABLE_PAYMENT_INTENT_STATUSES,
  CHECKOUT_CURRENCY,
  excessRefundGrossCents,
  mergeFeeAids,
  normalizeAidInputs,
  remainingDueCents,
} from "./stripeCheckoutUtils";

const stripeSecretKeyTest = defineSecret("STRIPE_SECRET_KEY_TEST");
const stripeSecretKeyLive = defineSecret("STRIPE_SECRET_KEY_LIVE");
const stripeWebhookSecretTest = defineSecret("STRIPE_WEBHOOK_SECRET_TEST");
const stripeWebhookSecretLive = defineSecret("STRIPE_WEBHOOK_SECRET_LIVE");
const stripePublishableKeyTest = defineSecret("STRIPE_PUBLISHABLE_KEY_TEST");
const stripePublishableKeyLive = defineSecret("STRIPE_PUBLISHABLE_KEY_LIVE");

const STRIPE_SECRETS = [
  stripeSecretKeyTest,
  stripeSecretKeyLive,
  stripeWebhookSecretTest,
  stripeWebhookSecretLive,
  stripePublishableKeyTest,
  stripePublishableKeyLive,
];

/** API v1 (PaymentIntents, Account Links, webhooks). */
const STRIPE_API_VERSION = "2025-02-24.acacia" as const;
/**
 * API Accounts v2 (création comptes Connect).
 * Le SDK stripe@17 n'expose pas encore `v2.core.accounts` — appels HTTP directs.
 */
const STRIPE_ACCOUNTS_V2_VERSION = "2026-01-28.clover";

type StripeConnectStatus =
  | "not_connected"
  | "pending"
  | "complete"
  | "restricted";

type StripeV2Account = {
  id: string;
};

/** Lazy-load SDK Stripe (évite timeout discovery Firebase au deploy). */
function loadStripeSdk(): typeof import("stripe").default {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("stripe") as typeof import("stripe").default;
}

/** Sélectionne les secrets Stripe selon la base Firestore (dev = test). */
function stripeCredentials(): {
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
} {
  if (isProdDatabase()) {
    return {
      secretKey: stripeSecretKeyLive.value().trim(),
      publishableKey: stripePublishableKeyLive.value().trim(),
      webhookSecret: stripeWebhookSecretLive.value().trim(),
    };
  }
  return {
    secretKey: stripeSecretKeyTest.value().trim(),
    publishableKey: stripePublishableKeyTest.value().trim(),
    webhookSecret: stripeWebhookSecretTest.value().trim(),
  };
}

/** Client Stripe API pour le contexte courant (test ou live). */
function stripeClient(): Stripe {
  const { secretKey } = stripeCredentials();
  if (!secretKey || !secretKey.startsWith("sk_")) {
    throw new HttpsError(
      "failed-precondition",
      "Clé secrète Stripe non configurée pour cet environnement",
    );
  }
  const StripeCtor = loadStripeSdk();
  return new StripeCtor(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

/**
 * Appel HTTP Accounts v2 (création token / compte).
 * En live, les account tokens exigent la clé publishable.
 */
async function stripeAccountsV2Request<T>(
  path: string,
  body: Record<string, unknown>,
  authKey: string,
): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authKey}`,
      "Content-Type": "application/json",
      "Stripe-Version": STRIPE_ACCOUNTS_V2_VERSION,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const err = payload.error as { message?: string; code?: string } | undefined;
    const message =
      (typeof err?.message === "string" && err.message) ||
      (typeof payload.message === "string" && payload.message) ||
      `Stripe Accounts v2 ${response.status}`;
    const code = typeof err?.code === "string" ? err.code : undefined;
    const wrapped = new Error(message) as Error & { code?: string };
    if (code) wrapped.code = code;
    throw wrapped;
  }
  return payload as T;
}

/**
 * Crée un compte Connect Express-équivalent via Accounts v2.
 * FR (PSD2) : passe par un account_token avant le create.
 */
async function createExpressConnectedAccountV2(params: {
  clubId: string;
  clubName: string;
  contactEmail?: string;
}): Promise<StripeV2Account> {
  const { secretKey, publishableKey } = stripeCredentials();
  if (!publishableKey || !publishableKey.startsWith("pk_")) {
    throw new HttpsError(
      "failed-precondition",
      "Clé publique Stripe non configurée pour cet environnement",
    );
  }

  const displayName = params.clubName.trim() || `Club ${params.clubId}`;
  const contactEmail =
    params.contactEmail?.trim() || `club-${params.clubId}@connect.viroteam.app`;

  // Token côté publishable (obligatoire en live / FR PSD2).
  // Ne pas accepter le ToS ici : avec Express, Stripe collecte les requirements
  // (sinon : "cannot accept the Terms of Service on behalf of accounts…").
  const accountToken = await stripeAccountsV2Request<{ id: string }>(
    "/v2/core/account_tokens",
    {
      contact_email: contactEmail,
      display_name: displayName,
      identity: {
        entity_type: "company",
        business_details: {
          registered_name: displayName,
        },
      },
    },
    publishableKey,
  );

  // Express dashboard exige fees + losses = application (équivalent Express v1).
  return stripeAccountsV2Request<StripeV2Account>(
    "/v2/core/accounts",
    {
      account_token: accountToken.id,
      identity: { country: "fr" },
      dashboard: "express",
      defaults: {
        currency: "eur",
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
        // Destination charges : le club reçoit un transfer (pas MoR du PaymentIntent).
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      metadata: { clubId: params.clubId },
      include: [
        "configuration.merchant",
        "configuration.recipient",
        "identity",
        "requirements",
      ],
    },
    secretKey,
  );
}

/** Transforme une erreur Stripe en HttpsError lisible côté client. */
function mapStripeCallableError(error: unknown, fallback: string): HttpsError {
  if (error instanceof HttpsError) return error;
  const message =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : fallback;
  if (message.includes("signed up for Connect")) {
    return new HttpsError(
      "failed-precondition",
      "Active Stripe Connect sur ton compte plateforme (dashboard.stripe.com/connect), puis réessaie.",
    );
  }
  if (
    message.includes("platform questionnaire") ||
    message.includes("connect_profile_not_submitted")
  ) {
    return new HttpsError(
      "failed-precondition",
      "Complète le questionnaire plateforme Connect dans le Dashboard Stripe, puis réessaie.",
    );
  }
  return new HttpsError("failed-precondition", message.slice(0, 300) || fallback);
}

/** Déduit le statut Connect depuis un Account Stripe. */
function connectStatusFromAccount(account: Stripe.Account): StripeConnectStatus {
  if (account.charges_enabled && account.details_submitted) {
    return "complete";
  }
  if (account.requirements?.disabled_reason) {
    return "restricted";
  }
  if (account.details_submitted || (account.requirements?.currently_due?.length ?? 0) > 0) {
    return "pending";
  }
  return "pending";
}

/**
 * Crée / reprend l'onboarding Stripe Connect Express pour le club (admin).
 * Renvoie l'URL Account Link ; ne marque jamais une cotisation payée.
 */
export const {
  prod: createStripeConnectLink,
  dev: createStripeConnectLinkDev,
} = defineDualCallable(
  { secrets: STRIPE_SECRETS },
  async (request: CallableRequest) => {
    const uid = requireUid(request);
    const clubId = requireString(request.data?.clubId, "clubId");
    const returnUrl = requireString(request.data?.returnUrl, "returnUrl");
    const refreshUrl = requireString(request.data?.refreshUrl, "refreshUrl");

    const { club } = await assertPermission(clubId, uid, PERMISSION_ADMIN);
    const stripe = stripeClient();
    const clubRef = db().collection("clubs").doc(clubId);

    try {
      let accountId = String(club.stripeConnectedAccountId ?? "").trim();
      if (!accountId) {
        const clubName =
          typeof club.name === "string" && club.name.trim()
            ? club.name.trim()
            : clubId;
        const contactEmail =
          typeof request.auth?.token?.email === "string"
            ? request.auth.token.email
            : undefined;
        const account = await createExpressConnectedAccountV2({
          clubId,
          clubName,
          contactEmail,
        });
        accountId = account.id;
        await clubRef.set(
          {
            stripeConnectedAccountId: accountId,
            stripeConnectStatus: "pending",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        await db()
          .collection("_system")
          .doc("stripe_accounts")
          .collection("by_account")
          .doc(accountId)
          .set(
            {
              clubId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      return {
        ok: true,
        url: accountLink.url,
        accountId,
        status: "pending" as StripeConnectStatus,
      };
    } catch (error) {
      throw mapStripeCallableError(error, "Impossible de lancer Stripe Connect");
    }
  },
);

/**
 * Rafraîchit le statut Connect Stripe du club (admin) depuis l'API Stripe.
 */
export const {
  prod: getStripeConnectStatus,
  dev: getStripeConnectStatusDev,
} = defineDualCallable(
  { secrets: STRIPE_SECRETS },
  async (request: CallableRequest) => {
    const uid = requireUid(request);
    const clubId = requireString(request.data?.clubId, "clubId");
    const { club } = await assertPermission(clubId, uid, PERMISSION_ADMIN);
    const accountId = String(club.stripeConnectedAccountId ?? "").trim();

    if (!accountId) {
      return {
        ok: true,
        status: "not_connected" as StripeConnectStatus,
        accountId: null,
        chargesEnabled: false,
        detailsSubmitted: false,
      };
    }

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(accountId);
    const status = connectStatusFromAccount(account);

    await db()
      .collection("clubs")
      .doc(clubId)
      .set(
        {
          stripeConnectStatus: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return {
      ok: true,
      status,
      accountId,
      chargesEnabled: Boolean(account.charges_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
  },
);

/**
 * Crée un PaymentIntent Stripe (destination charge) après aides.
 * Ne marque jamais la cotisation payée — réservé au webhook.
 */
export const {
  prod: createStripeCheckout,
  dev: createStripeCheckoutDev,
} = defineDualCallable(
  { secrets: STRIPE_SECRETS },
  async (request: CallableRequest) => {
    const uid = requireUid(request);
    const clubId = requireString(request.data?.clubId, "clubId");
    const seasonId = requireString(request.data?.seasonId, "seasonId");
    const memberId = requireString(request.data?.memberId, "memberId");
    const clientAmountCents = Number(request.data?.amountCents ?? 0);
    // Devise : `eur` imposée côté serveur. Toute autre valeur est refusée
    // (le webhook re-vérifie la devise du PaymentIntent avant de créditer).
    const currencyRaw = String(request.data?.currency ?? CHECKOUT_CURRENCY)
      .trim()
      .toLowerCase();
    if (currencyRaw && currencyRaw !== CHECKOUT_CURRENCY) {
      throw new HttpsError("invalid-argument", "Devise non supportée (EUR uniquement)");
    }
    const currency = CHECKOUT_CURRENCY;

    await assertCanActForMember({
      clubId,
      memberId,
      uid,
      permission: "canPay",
    });

    if (!Number.isFinite(clientAmountCents) || clientAmountCents < 0) {
      throw new HttpsError("invalid-argument", "Montant invalide");
    }

    const clubSnap = await db().collection("clubs").doc(clubId).get();
    if (!clubSnap.exists) {
      throw new HttpsError("not-found", "Club introuvable");
    }
    const club = clubSnap.data()!;
    const connectedAccountId = String(
      club.stripeConnectedAccountId ?? "",
    ).trim();
    const connectStatus = String(club.stripeConnectStatus ?? "");
    const onlineEnabled = club.onlinePaymentEnabled === true;

    if (!onlineEnabled) {
      throw new HttpsError(
        "failed-precondition",
        "Paiement en ligne désactivé pour ce club",
      );
    }
    if (!connectedAccountId || connectStatus !== "complete") {
      throw new HttpsError(
        "failed-precondition",
        "Compte Stripe du club non prêt (Connect)",
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
    const fee = feeSnap.data()!;

    // Reste dû recalculé côté serveur : le client ne choisit pas le montant,
    // il peut seulement payer une partie (min(clientNet, resteDû)).
    const seasonSnap = await db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .get();
    const tiers =
      (seasonSnap.data()?.tiers as { tierId?: unknown; amountCents?: unknown }[] | undefined) ?? [];
    const tier = tiers.find((t) => String(t.tierId ?? "") === String(fee.tierId ?? ""));
    const remainingCents = remainingDueCents({
      tierAmountCents: Number(tier?.amountCents ?? 0),
      feeStatus: typeof fee.status === "string" ? fee.status : undefined,
      amountPaidCents: fee.amountPaidCents,
      aids: fee.aids,
    });
    const netCents = boundedNetCents(clientAmountCents, remainingCents);
    const aids = normalizeAidInputs(request.data?.aids, remainingCents);

    if (netCents <= 0 && aids.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        remainingCents <= 0
          ? "Cotisation déjà réglée"
          : "Montant invalide",
      );
    }

    const sessionRef = db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("payment_sessions")
      .doc();

    const now = admin.firestore.Timestamp.now();
    const aidDocs = aids.map((a, index) => ({
      id: `${sessionRef.id}_${index}`,
      type: a.type,
      label: a.label ?? aidLabel(a.type),
      amountCents: a.amountCents,
      status: "pending_proof",
      promoCode: a.promoCode,
      createdAt: now,
    }));

    if (netCents <= 0) {
      await feeRef.set(
        {
          aids: mergeFeeAids(fee.aids, aidDocs, sessionRef.id),
          status: "partiel",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return {
        ok: true,
        sessionId: sessionRef.id,
        clientSecret: null,
        publishableKey: null,
        paymentIntentId: null,
        message: "Aides enregistrées — en attente de justificatif",
      };
    }

    const stripe = stripeClient();
    // Verrou sur la cotisation : deux checkouts simultanés ne peuvent pas
    // chacun annuler / créer un PaymentIntent (deux PI encaissables).
    const lockedFee = await acquireCheckoutLock(feeRef, sessionRef.id);
    try {
      return await createLockedPaymentIntent({
        stripe,
        feeRef,
        fee: lockedFee,
        sessionRef,
        netCents,
        aidDocs,
        club,
        clubId,
        seasonId,
        memberId,
        connectedAccountId,
        currency,
        uid,
      });
    } finally {
      await releaseCheckoutLock(feeRef, sessionRef.id);
    }
  },
);

/** Durée de validité d'un verrou de checkout (au-delà : verrou orphelin). */
const CHECKOUT_LOCK_TTL_MS = 60_000;

/**
 * Pose `checkoutLock` sur la cotisation (transaction) et renvoie ses données
 * fraîches. Refuse si un autre checkout tient un verrou récent.
 */
async function acquireCheckoutLock(
  feeRef: admin.firestore.DocumentReference,
  sessionId: string,
): Promise<admin.firestore.DocumentData> {
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(feeRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Cotisation introuvable");
    }
    const data = snap.data()!;
    const lockAt = data.checkoutLock?.at as admin.firestore.Timestamp | undefined;
    const lockAge = lockAt?.toMillis ? Date.now() - lockAt.toMillis() : Infinity;
    if (data.checkoutLock && lockAge < CHECKOUT_LOCK_TTL_MS) {
      throw new HttpsError(
        "failed-precondition",
        "Un paiement est déjà en cours de préparation pour cette cotisation — réessaie dans un instant",
      );
    }
    tx.update(feeRef, {
      checkoutLock: { sessionId, at: admin.firestore.Timestamp.now() },
    });
    return data;
  });
}

/** Retire `checkoutLock` s'il appartient encore à [sessionId] (best-effort). */
async function releaseCheckoutLock(
  feeRef: admin.firestore.DocumentReference,
  sessionId: string,
): Promise<void> {
  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(feeRef);
      if (snap.get("checkoutLock.sessionId") !== sessionId) return;
      tx.update(feeRef, { checkoutLock: admin.firestore.FieldValue.delete() });
    });
  } catch (error) {
    // Le verrou expire de lui-même après CHECKOUT_LOCK_TTL_MS.
    console.error("releaseCheckoutLock failed", { sessionId, error });
  }
}

/**
 * Sous verrou : annule le PaymentIntent précédent s'il est annulable, crée le
 * nouveau (clé d'idempotence = session) et l'enregistre sur la session et la
 * cotisation.
 */
async function createLockedPaymentIntent(params: {
  stripe: Stripe;
  feeRef: admin.firestore.DocumentReference;
  fee: admin.firestore.DocumentData;
  sessionRef: admin.firestore.DocumentReference;
  netCents: number;
  aidDocs: Record<string, unknown>[];
  club: admin.firestore.DocumentData;
  clubId: string;
  seasonId: string;
  memberId: string;
  connectedAccountId: string;
  currency: string;
  uid: string;
}): Promise<Record<string, unknown>> {
  const {
    stripe,
    feeRef,
    fee,
    sessionRef,
    netCents,
    aidDocs,
    club,
    clubId,
    seasonId,
    memberId,
    connectedAccountId,
    currency,
    uid,
  } = params;
  await releasePreviousPaymentIntent({
    stripe,
    fee,
    feeRef,
  });

  const grossCents = cardGrossCentsFromNet(netCents);
  const applicationFeeCents = cardFeeCentsFromNet(netCents);

  const { publishableKey } = stripeCredentials();
  if (!publishableKey || !publishableKey.startsWith("pk_")) {
    throw new HttpsError(
      "failed-precondition",
      "Clé publique Stripe non configurée pour cet environnement",
    );
  }

  const clubName =
    typeof club.name === "string" && club.name.trim()
      ? club.name.trim()
      : clubId;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: grossCents,
    currency,
    automatic_payment_methods: { enabled: true },
    transfer_data: {
      destination: connectedAccountId,
    },
    application_fee_amount: applicationFeeCents,
    description: `Cotisation ${clubName}`.slice(0, 250),
    metadata: {
      sessionId: sessionRef.id,
      clubId,
      seasonId,
      memberId,
      provider: "stripe",
      netAmountCents: String(netCents),
      applicationFeeCents: String(applicationFeeCents),
    },
  }, { idempotencyKey: `checkout_${sessionRef.id}` });

  if (!paymentIntent.client_secret) {
    throw new HttpsError(
      "internal",
      "Stripe n'a pas renvoyé de client_secret",
    );
  }

  await sessionRef.set({
    clubId,
    seasonId,
    memberId,
    amountCents: netCents,
    grossAmountCents: grossCents,
    applicationFeeCents,
    installmentCount: 1,
    aids: aidDocs,
    status: "pending",
    paymentIntentId: paymentIntent.id,
    provider: "stripe",
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await feeRef.set(
    {
      aids: mergeFeeAids(fee.aids, aidDocs, sessionRef.id),
      paymentIntentId: paymentIntent.id,
      installmentCount: 1,
      paymentProvider: "stripe",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ok: true,
    sessionId: sessionRef.id,
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    publishableKey,
  };
}

/**
 * Webhook Stripe — seule source de vérité pour marquer un paiement CB.
 * Prod → v2-prod ; `stripeWebhookDev` → v2-dev.
 */
export const {
  prod: stripeWebhook,
  dev: stripeWebhookDev,
} = defineDualRequest(
  { secrets: STRIPE_SECRETS },
  async (req: Request, res: Response) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const { secretKey, webhookSecret } = stripeCredentials();
    if (!secretKey.startsWith("sk_") || !webhookSecret || webhookSecret === "pending") {
      res.status(503).json({ error: "webhook disabled" });
      return;
    }

    const StripeCtor = loadStripeSdk();
    const stripe = new StripeCtor(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    const signature = req.get("stripe-signature");
    if (!signature) {
      res.status(400).json({ error: "missing signature" });
      return;
    }

    let event: Stripe.Event;
    try {
      const rawBody =
        (req as Request & { rawBody?: Buffer }).rawBody ??
        Buffer.from(JSON.stringify(req.body));
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("stripeWebhook signature failed", err);
      res.status(400).json({ error: "invalid signature" });
      return;
    }

    try {
      if (event.type === "account.updated") {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
        res.json({ ok: true });
        return;
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(stripe, paymentIntent);
        res.json({ ok: true });
        return;
      }

      res.json({ ok: true, ignored: event.type });
    } catch (e) {
      console.error("stripeWebhook error", e);
      res.status(500).json({ error: "webhook failed" });
    }
  },
);

/**
 * Un seul PaymentIntent ouvert par cotisation : avant d'en créer un nouveau,
 * annule le précédent s'il n'a rien débité. Refuse si le précédent est en
 * cours de traitement ou réussi mais pas encore crédité (webhook en route),
 * sinon les deux pourraient être encaissés.
 */
async function releasePreviousPaymentIntent(params: {
  stripe: Stripe;
  fee: admin.firestore.DocumentData;
  feeRef: admin.firestore.DocumentReference;
}): Promise<void> {
  const { stripe, fee, feeRef } = params;
  const previousId = String(fee.paymentIntentId ?? "").trim();
  if (!previousId) return;
  const applied = (fee.appliedExternalPaymentIds as string[] | undefined) ?? [];
  if (applied.includes(previousId)) return;

  const previous = await stripe.paymentIntents.retrieve(previousId);
  if (previous.status === "canceled") return;
  if (CANCELABLE_PAYMENT_INTENT_STATUSES.has(previous.status)) {
    await stripe.paymentIntents.cancel(previousId, {
      cancellation_reason: "duplicate",
    });
    const previousSessionId = String(previous.metadata?.sessionId ?? "").trim();
    if (previousSessionId) {
      await feeRef.parent.parent!
        .collection("payment_sessions")
        .doc(previousSessionId)
        .set(
          {
            status: "canceled",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    }
    return;
  }
  throw new HttpsError(
    "failed-precondition",
    "Un paiement est déjà en cours de traitement pour cette cotisation",
  );
}

/**
 * Rembourse intégralement un PaymentIntent dont rien n'a été crédité
 * (cotisation déjà réglée entre-temps). Idempotent : clé Stripe dédiée, et
 * la session reste `refund_pending` tant que le remboursement n'a pas
 * abouti, donc un rejeu du webhook le retente.
 */
async function refundUncreditedPaymentIntent(params: {
  stripe: Stripe;
  paymentIntent: Stripe.PaymentIntent;
  clubId: string;
  seasonId: string;
  sessionId: string;
}): Promise<void> {
  const { stripe, paymentIntent, clubId, seasonId, sessionId } = params;
  if (!sessionId) {
    console.error("stripe overpayment without session, refund manually", {
      paymentIntentId: paymentIntent.id,
      clubId,
      seasonId,
    });
    return;
  }
  const sessionRef = db()
    .collection("clubs")
    .doc(clubId)
    .collection("fee_seasons")
    .doc(seasonId)
    .collection("payment_sessions")
    .doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (sessionSnap.data()?.status !== "refund_pending") return;

  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntent.id,
      reason: "duplicate",
      refund_application_fee: true,
      reverse_transfer: true,
    },
    { idempotencyKey: `overpayment_refund_${paymentIntent.id}` },
  );
  await sessionRef.set(
    {
      status: "refunded",
      refundId: refund.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Rembourse l'excédent d'un paiement partiellement crédité (deux paiements
 * pour la même cotisation). Rejouable : n'agit que si la session porte
 * `excessRefundStatus: "pending"` ; clé d'idempotence Stripe dédiée. Le
 * montant brut est proratisé (frais de l'excédent rendus au payeur).
 */
async function refundPartialExcess(params: {
  stripe: Stripe;
  paymentIntent: Stripe.PaymentIntent;
  clubId: string;
  seasonId: string;
  sessionId: string;
}): Promise<void> {
  const { stripe, paymentIntent, clubId, seasonId, sessionId } = params;
  if (!sessionId) return;
  const sessionRef = db()
    .collection("clubs")
    .doc(clubId)
    .collection("fee_seasons")
    .doc(seasonId)
    .collection("payment_sessions")
    .doc(sessionId);
  const session = (await sessionRef.get()).data();
  if (session?.excessRefundStatus !== "pending") return;
  const metadataNet = Number(paymentIntent.metadata?.netAmountCents ?? 0);
  const netCents =
    Number.isFinite(metadataNet) && metadataNet > 0
      ? metadataNet
      : Number(session.amountCents ?? 0);
  const refundCents = excessRefundGrossCents({
    excessNetCents: Number(session.excessCents ?? 0),
    netCents,
    grossCents: Number(paymentIntent.amount_received || paymentIntent.amount || 0),
  });
  if (refundCents <= 0) {
    console.error("stripe excess refund: montant incalculable, remboursement manuel", {
      paymentIntentId: paymentIntent.id,
      clubId,
      seasonId,
      sessionId,
    });
    await sessionRef.set(
      { excessRefundStatus: "manual", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
    return;
  }
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntent.id,
      amount: refundCents,
      reason: "duplicate",
      refund_application_fee: true,
      reverse_transfer: true,
    },
    { idempotencyKey: `excess_refund_${paymentIntent.id}` },
  );
  await sessionRef.set(
    {
      excessRefundStatus: "refunded",
      excessRefundId: refund.id,
      excessRefundCents: refundCents,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Paiement réussi dont la cotisation est introuvable (même via les anciens
 * ids de fiche) : remboursement intégral (clé d'idempotence dédiée, donc un
 * rejeu du webhook ne rembourse pas deux fois) et trace exploitable dans
 * `_system/stripe_orphan_payments/items/{paymentIntentId}` + la session.
 * Si le remboursement échoue, l'erreur remonte (500) et Stripe rejoue.
 */
async function refundOrphanPaymentIntent(params: {
  stripe: Stripe;
  paymentIntent: Stripe.PaymentIntent;
  clubId: string;
  seasonId: string;
  memberId: string;
  sessionId: string;
}): Promise<void> {
  const { stripe, paymentIntent, clubId, seasonId, memberId, sessionId } = params;
  console.error("stripe payment without fee: remboursement intégral", {
    paymentIntentId: paymentIntent.id,
    clubId,
    seasonId,
    memberId,
  });
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntent.id,
      reason: "requested_by_customer",
      refund_application_fee: true,
      reverse_transfer: true,
    },
    { idempotencyKey: `orphan_refund_${paymentIntent.id}` },
  );
  const now = admin.firestore.FieldValue.serverTimestamp();
  await db()
    .collection("_system")
    .doc("stripe_orphan_payments")
    .collection("items")
    .doc(paymentIntent.id)
    .set(
      {
        clubId,
        seasonId,
        memberId,
        sessionId: sessionId || null,
        amountCents: Number(paymentIntent.amount_received || paymentIntent.amount || 0),
        refundId: refund.id,
        status: "refunded",
        updatedAt: now,
      },
      { merge: true },
    );
  if (sessionId) {
    await db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("payment_sessions")
      .doc(sessionId)
      .set(
        { status: "refunded", refundReason: "fee_missing", refundId: refund.id, updatedAt: now },
        { merge: true },
      );
  }
}

/** Met à jour le statut Connect du club lié au compte Stripe. */
async function handleAccountUpdated(account: Stripe.Account): Promise<void> {
  let clubId = String(account.metadata?.clubId ?? "").trim();
  if (!clubId) {
    const mapSnap = await db()
      .collection("_system")
      .doc("stripe_accounts")
      .collection("by_account")
      .doc(account.id)
      .get();
    clubId = String(mapSnap.data()?.clubId ?? "").trim();
  }
  if (!clubId) {
    console.warn("stripe account.updated without clubId", account.id);
    return;
  }

  const status = connectStatusFromAccount(account);
  await db()
    .collection("clubs")
    .doc(clubId)
    .set(
      {
        stripeConnectedAccountId: account.id,
        stripeConnectStatus: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/** Crédite la cotisation après PaymentIntent réussi. */
async function handlePaymentIntentSucceeded(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
): Promise<void> {
  const metadata = paymentIntent.metadata ?? {};
  const clubId = String(metadata.clubId ?? "");
  const seasonId = String(metadata.seasonId ?? "");
  const memberId = String(metadata.memberId ?? "");
  const sessionId = String(metadata.sessionId ?? "");

  if (!clubId || !seasonId || !memberId) {
    console.warn("payment_intent.succeeded metadata incomplete", paymentIntent.id);
    return;
  }

  // Devise : seul l'EUR est crédité (le checkout ne crée que des PI en EUR ;
  // tout autre cas est une anomalie à investiguer, pas un paiement à créditer).
  const currency = String(paymentIntent.currency ?? "").toLowerCase();
  if (currency !== CHECKOUT_CURRENCY) {
    console.error("payment_intent.succeeded ignored: unexpected currency", {
      paymentIntentId: paymentIntent.id,
      currency,
      clubId,
      seasonId,
      memberId,
    });
    return;
  }

  let amountCents = 0;
  const metadataNet = Number(metadata.netAmountCents ?? 0);
  if (Number.isFinite(metadataNet) && metadataNet > 0) {
    amountCents = Math.round(metadataNet);
  } else if (sessionId) {
    const sessionSnap = await db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("payment_sessions")
      .doc(sessionId)
      .get();
    const sessionNet = Number(sessionSnap.data()?.amountCents ?? 0);
    if (Number.isFinite(sessionNet) && sessionNet > 0) {
      amountCents = Math.round(sessionNet);
    }
  }
  if (amountCents <= 0) {
    amountCents = Number(
      paymentIntent.amount_received || paymentIntent.amount || 0,
    );
  }
  let credit: Awaited<ReturnType<typeof creditMemberFeeFromCardPayment>>;
  try {
    credit = await creditMemberFeeFromCardPayment({
      clubId,
      seasonId,
      memberId,
      sessionId,
      amountCents,
      externalPaymentId: paymentIntent.id,
      provider: "stripe",
    });
  } catch (error) {
    if (!(error instanceof FeeNotFoundError)) throw error;
    // Cotisation introuvable même via `formerMemberIds` (supprimée, saison
    // effacée…) : rembourser est le plus sûr (le payeur récupère son argent,
    // rien n'est crédité à tort) plutôt qu'un 500 rejoué indéfiniment.
    await refundOrphanPaymentIntent({ stripe, paymentIntent, clubId, seasonId, memberId, sessionId });
    return;
  }
  const { creditedCents, excessCents } = credit;
  const creditedMemberId = credit.memberId;

  if (excessCents > 0) {
    console.warn("stripe payment exceeds remaining due (remboursement de l'excédent)", {
      paymentIntentId: paymentIntent.id,
      clubId,
      seasonId,
      memberId: creditedMemberId,
      creditedCents,
      excessCents,
    });
  }
  // Rejoué aussi quand le crédit a déjà été appliqué (retry webhook après un
  // remboursement en échec) : la session porte l'état `refund_pending`.
  if (creditedCents <= 0) {
    await refundUncreditedPaymentIntent({
      stripe,
      paymentIntent,
      clubId,
      seasonId,
      sessionId,
    });
    await refundPartialExcess({ stripe, paymentIntent, clubId, seasonId, sessionId });
    return;
  }
  await refundPartialExcess({ stripe, paymentIntent, clubId, seasonId, sessionId });

  try {
    const feeRef = db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("member_fees")
      .doc(creditedMemberId);
    const receiptUrl = await generateAndStoreReceipt({
      clubId,
      seasonId,
      memberId: creditedMemberId,
      amountCents: creditedCents,
      externalPaymentId: paymentIntent.id,
      providerLabel: "encaissement confirmé (Stripe)",
    });
    if (receiptUrl) {
      await feeRef.set({ receiptUrl }, { merge: true });
    }
  } catch (e) {
    console.error("stripe receipt generation failed", e);
  }
}
