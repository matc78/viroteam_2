import { AsyncLocalStorage } from "node:async_hooks";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import {
  onCall,
  onRequest,
  type CallableOptions,
  type CallableRequest,
  type HttpsOptions,
  type Request,
} from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import type { Response } from "express";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

setGlobalOptions({ region: "europe-west1" });

/** Bases Firestore v2 — jamais la base default. */
export type FirestoreDatabaseId = "v2-dev" | "v2-prod";

const databaseContext = new AsyncLocalStorage<FirestoreDatabaseId>();

/**
 * Exécute [fn] avec [databaseId] comme base Firestore courante pour [db].
 */
export function runWithDatabase<T>(
  databaseId: FirestoreDatabaseId,
  fn: () => T,
): T {
  return databaseContext.run(databaseId, fn);
}

/**
 * Instance Firestore du contexte callable / HTTP courant.
 *
 * Doit être appelé depuis un handler enregistré via [defineDualCallable]
 * ou [defineDualRequest] (sinon throw).
 */
export function db(): FirebaseFirestore.Firestore {
  const databaseId = databaseContext.getStore();
  if (!databaseId) {
    throw new Error(
      "db() hors contexte : utiliser defineDualCallable / runWithDatabase",
    );
  }
  return getFirestore(admin.app(), databaseId);
}

type DualHttpsFns<T> = {
  prod: T;
  dev: T;
};

/**
 * Enregistre une callable prod (`name`) et une copie Dev (`nameDev`)
 * pointant respectivement vers `v2-prod` et `v2-dev`.
 */
export function defineDualCallable<T = unknown>(
  handler: (request: CallableRequest) => Promise<T> | T,
): DualHttpsFns<ReturnType<typeof onCall>>;
export function defineDualCallable<T = unknown>(
  options: CallableOptions,
  handler: (request: CallableRequest) => Promise<T> | T,
): DualHttpsFns<ReturnType<typeof onCall>>;
export function defineDualCallable<T = unknown>(
  optionsOrHandler:
    | CallableOptions
    | ((request: CallableRequest) => Promise<T> | T),
  maybeHandler?: (request: CallableRequest) => Promise<T> | T,
): DualHttpsFns<ReturnType<typeof onCall>> {
  const options =
    typeof optionsOrHandler === "function" ? {} : optionsOrHandler;
  const handler =
    typeof optionsOrHandler === "function" ? optionsOrHandler : maybeHandler!;

  const wrap = (databaseId: FirestoreDatabaseId) =>
    onCall(options, async (request) =>
      runWithDatabase(databaseId, () => handler(request)),
    );

  return {
    prod: wrap("v2-prod"),
    dev: wrap("v2-dev"),
  };
}

type RequestHandler = (req: Request, res: Response) => void | Promise<void>;

/**
 * Enregistre un endpoint HTTP prod + Dev avec contexte Firestore dédié.
 */
export function defineDualRequest(
  options: HttpsOptions,
  handler: RequestHandler,
): DualHttpsFns<ReturnType<typeof onRequest>> {
  const wrap = (databaseId: FirestoreDatabaseId) =>
    onRequest(options, async (req, res) =>
      runWithDatabase(databaseId, () => handler(req, res)),
    );

  return {
    prod: wrap("v2-prod"),
    dev: wrap("v2-dev"),
  };
}
