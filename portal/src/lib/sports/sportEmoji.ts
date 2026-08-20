/** Emoji associé au sport d’un club (libellés ClubSports Flutter, clés normalisées). */
const SPORT_EMOJI_BY_KEY: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
  volleyball: "🏐",
  handball: "🤾",
  rugby: "🏉",
  tennis: "🎾",
  natation: "🏊",
  athletisme: "🏃",
  judo: "🥋",
  escrime: "🤺",
  aviron: "🚣",
  autre: "🏅",
};

/**
 * Retourne l’emoji du sport du club, ou un trophée générique si inconnu.
 */
export function sportEmoji(sport: string | null | undefined): string {
  const key = (sport ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/-/g, "");
  if (!key) return "🏅";
  return SPORT_EMOJI_BY_KEY[key] ?? "🏅";
}

/**
 * Libellé club avec emoji sport (ex. « 🏐 viro volley »).
 */
export function clubLabelWithSportEmoji(params: {
  name: string;
  sport: string | null | undefined;
}): string {
  const name = params.name.trim() || "Club";
  return `${sportEmoji(params.sport)} ${name}`;
}
