import { ClubSetupDefaults } from "./constants";

const BLOCKED_PICKER_HEXES = new Set([
  "#FFFFFF",
  "#FACC15",
  "#9BB8DC",
  "#F4F6F9",
  "#ECEFF4",
]);

/** Palette picker — ordre aligné lib/utils/club_color.dart Flutter. */
export const CLUB_BRAND_COLOR_PRESETS = [
  "#DC2626",
  "#E11D48",
  "#BE185D",
  "#DB2777",
  "#F97316",
  "#EA580C",
  "#CA8A04",
  "#22C55E",
  "#65A30D",
  "#10B981",
  "#059669",
  "#14B8A6",
  "#0D9488",
  "#0891B2",
  "#2563EB",
  "#0284C7",
  "#3B82F6",
  "#134A7D",
  "#0F3A63",
  "#8B5CF6",
  "#7C3AED",
  "#4F46E5",
  "#78350F",
  "#475569",
  "#171717",
] as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Texte lisible sur un fond de marque club (blanc ou presque noir). */
export function readableTextOnBrand(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#0F172A" : "#FFFFFF";
}

/** Couleur autorisée pour la marque club (contraste sur fond blanc). */
export function isAllowedClubBrandColor(hex: string): boolean {
  const normalized = hex.trim().toUpperCase();
  if (BLOCKED_PICKER_HEXES.has(normalized)) return false;
  return relativeLuminance(normalized) <= 0.72;
}

/** Presets filtrés (sans teintes trop claires). */
export function buildClubBrandColorPresets(): string[] {
  const seen = new Set<string>();
  const presets: string[] = [];
  for (const hex of CLUB_BRAND_COLOR_PRESETS) {
    const normalized = hex.toUpperCase();
    if (BLOCKED_PICKER_HEXES.has(normalized)) continue;
    if (!isAllowedClubBrandColor(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    presets.push(normalized);
  }
  return presets;
}

export function parseClubBrandColorsFromStorage(
  value: string | null | undefined,
): { primary: string; secondary?: string } | null {
  if (!value?.trim()) return null;
  const parts = value.split("+");
  if (parts.length === 1) {
    const primary = parts[0].trim().toUpperCase();
    if (!hexToRgb(primary)) return null;
    return { primary };
  }
  if (parts.length === 2) {
    const primary = parts[0].trim().toUpperCase();
    const secondary = parts[1].trim().toUpperCase();
    if (!hexToRgb(primary) || !hexToRgb(secondary)) return null;
    return { primary, secondary };
  }
  return null;
}

export function sanitizeBrandColorHex(
  stored: string | null | undefined,
  fallback = ClubSetupDefaults.brandColorHex,
): string {
  if (!stored?.trim()) return fallback;
  const parsed = parseClubBrandColorsFromStorage(stored);
  if (!parsed || !isAllowedClubBrandColor(parsed.primary)) return fallback;
  if (!parsed.secondary) return parsed.primary;
  if (!isAllowedClubBrandColor(parsed.secondary)) return parsed.primary;
  return encodeBrandColorHex({
    primary: parsed.primary,
    secondary: parsed.secondary,
  });
}

export function splitBrandColorHex(stored: string): {
  primary: string;
  secondary: string | null;
} {
  const sanitized = sanitizeBrandColorHex(stored);
  const parsed = parseClubBrandColorsFromStorage(sanitized);
  if (!parsed) return { primary: sanitized, secondary: null };
  return {
    primary: parsed.primary,
    secondary: parsed.secondary ?? null,
  };
}

export function encodeBrandColorHex(params: {
  primary: string;
  secondary?: string | null;
}): string {
  const normalizedPrimary = params.primary.trim().toUpperCase();
  const normalizedSecondary = params.secondary?.trim().toUpperCase();
  if (
    !normalizedSecondary ||
    normalizedSecondary === normalizedPrimary
  ) {
    return normalizedPrimary;
  }
  return `${normalizedPrimary}+${normalizedSecondary}`;
}

export function clubBrandColorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}
