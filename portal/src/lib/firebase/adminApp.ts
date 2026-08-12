import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { App, cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

export class DevAuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevAuthConfigError";
  }
}

function loadServiceAccountFromFile(): ServiceAccountJson | null {
  const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH?.trim();
  if (!keyPath) return null;

  const absolutePath = resolve(process.cwd(), keyPath);
  if (!existsSync(absolutePath)) {
    const doubleExtensionPath = `${absolutePath}.json`;
    if (absolutePath.endsWith(".json") && existsSync(doubleExtensionPath)) {
      throw new DevAuthConfigError(
        `Clé Admin introuvable (${keyPath}). Fichier détecté : ${keyPath}.json — renomme-le en ${keyPath}.`,
      );
    }

    throw new DevAuthConfigError(
      `Clé Admin introuvable : ${keyPath}. Télécharge-la depuis Firebase Console → Comptes de service → Générer une nouvelle clé privée, puis place le JSON dans portal/.`,
    );
  }

  const raw = readFileSync(absolutePath, "utf8");
  return JSON.parse(raw) as ServiceAccountJson;
}

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "viroteam-75303";
  const keyFile = loadServiceAccountFromFile();
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || keyFile?.client_email;
  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") ||
    keyFile?.private_key;

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId: keyFile?.project_id || projectId,
        clientEmail,
        privateKey,
      }),
      projectId: keyFile?.project_id || projectId,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

/** Auth Admin Firebase pour le contournement dev local. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
