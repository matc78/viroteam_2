/**
 * Marquage de campagne des liens store (mêmes conventions que l'app
 * `store_links.dart` et le portail `storeLinks.ts`) : `utm_source` = surface,
 * `utm_campaign` = emplacement.
 */

/** Ajoute le `referrer` UTM lu par la Play Console à [url]. */
export function withPlayStoreCampaign(
  url: string,
  source: string,
  campaign: string,
): string {
  const parsed = new URL(url);
  parsed.searchParams.set(
    "referrer",
    `utm_source=${source}&utm_campaign=${campaign}`,
  );
  return parsed.toString();
}

/**
 * Ajoute la campagne `ct` (`{source}_{campaign}`) lue par App Store Connect ;
 * un `pt` déjà présent dans [url] est conservé.
 */
export function withAppStoreCampaign(
  url: string,
  source: string,
  campaign: string,
): string {
  const parsed = new URL(url);
  parsed.searchParams.set("ct", `${source}_${campaign}`);
  parsed.searchParams.set("mt", "8");
  return parsed.toString();
}
