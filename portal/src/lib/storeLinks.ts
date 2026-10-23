import { site } from "@/lib/site";

/**
 * Emplacement d’un lien « Télécharger l’app » : lu par la Play Console
 * (acquisition UTM) et App Store Connect (liens de campagne).
 * Mêmes valeurs que l’app (`StoreCampaign`) et les Functions (`storeLinks.ts`).
 */
export type StoreCampaign = "store_badges" | "invite_share";

const SOURCE = "portal";

/**
 * Jeton fournisseur App Store Connect (`pt`) : sans lui, Apple ignore `ct`.
 * À renseigner depuis App Store Connect › App Analytics › Acquisition ›
 * Campaigns (générateur de lien).
 */
export const APP_STORE_PROVIDER_TOKEN = "";

/** Lien Google Play avec `referrer` UTM (source portail + [campaign]). */
export function playStoreLink(campaign: StoreCampaign): string {
  const referrer = `utm_source=${SOURCE}&utm_campaign=${campaign}`;
  return `${site.playStoreUrl}&referrer=${encodeURIComponent(referrer)}`;
}

/** Lien App Store avec campagne `ct` (et `pt` s’il est configuré). */
export function appStoreLink(campaign: StoreCampaign): string {
  const params = new URLSearchParams();
  if (APP_STORE_PROVIDER_TOKEN) params.set("pt", APP_STORE_PROVIDER_TOKEN);
  params.set("ct", `${SOURCE}_${campaign}`);
  params.set("mt", "8");
  return `${site.appStoreUrl}?${params.toString()}`;
}
