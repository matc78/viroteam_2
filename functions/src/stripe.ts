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
import { assertCanActForMember, assertClubAdmin } from "./guardians";
import {
  aidLabel,
  creditMemberFeeFromCardPayment,
  generateAndStoreReceipt,
} from "./feePayments";
import { requireString, requireUid } from "./common";

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

type AidInput = {
  type: string;
  amountCents: number;
  promoCode?: string;
  label?: string;
};

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

    const club = await assertClubAdmin(clubId, uid);
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
    const club = await assertClubAdmin(clubId, uid);
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
    const amountCents = Number(request.data?.amountCents ?? 0);
    const aids = (request.data?.aids as AidInput[] | undefined) ?? [];
    const currencyRaw = String(request.data?.currency ?? "eur").toLowerCase();
    const currency = currencyRaw === "eur" ? "eur" : currencyRaw;

    await assertCanActForMember({
      clubId,
      memberId,
      uid,
      permission: "canPay",
    });

    if (amountCents < 0) {
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
        clientSecret: null,
        publishableKey: null,
        paymentIntentId: null,
        message: "Aides enregistrées — en attente de justificatif",
      };
    }

    const { publishableKey } = stripeCredentials();
    if (!publishableKey || !publishableKey.startsWith("pk_")) {
      throw new HttpsError(
        "failed-precondition",
        "Clé publique Stripe non configurée pour cet environnement",
      );
    }

    const stripe = stripeClient();
    const clubName =
      typeof club.name === "string" && club.name.trim()
        ? club.name.trim()
        : clubId;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: cardAmount,
      currency,
      automatic_payment_methods: { enabled: true },
      transfer_data: {
        destination: connectedAccountId,
      },
      description: `Cotisation ${clubName}`.slice(0, 250),
      metadata: {
        sessionId: sessionRef.id,
        clubId,
        seasonId,
        memberId,
        provider: "stripe",
      },
    });

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
      amountCents: cardAmount,
      installmentCount: 1,
      aids: aidDocs,
      status: "pending",
      paymentIntentId: paymentIntent.id,
      provider: "stripe",
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const existingAids =
      (feeSnap.data()?.aids as Record<string, unknown>[] | undefined) ?? [];
    await feeRef.set(
      {
        aids: aidDocs.length > 0 ? [...existingAids, ...aidDocs] : existingAids,
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
  },
);

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
        await handlePaymentIntentSucceeded(paymentIntent);
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

  const amountCents = Number(paymentIntent.amount_received || paymentIntent.amount || 0);
  const { creditedCents } = await creditMemberFeeFromCardPayment({
    clubId,
    seasonId,
    memberId,
    sessionId,
    amountCents,
    externalPaymentId: paymentIntent.id,
    provider: "stripe",
  });

  if (creditedCents <= 0) return;

  try {
    const feeRef = db()
      .collection("clubs")
      .doc(clubId)
      .collection("fee_seasons")
      .doc(seasonId)
      .collection("member_fees")
      .doc(memberId);
    const receiptUrl = await generateAndStoreReceipt({
      clubId,
      seasonId,
      memberId,
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
