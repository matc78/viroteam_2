import * as Sentry from "@sentry/nextjs";
import {
  dataUrlToBytes,
  type ClubSetupDraft,
} from "@/lib/clubSetup/clubSetupDraft";
import {
  formatAddressLine,
  formatCity,
  formatPostalCode,
} from "@/lib/format/personDataFormat";
import { defaultSeasonEndDate } from "@/lib/planning/seasonEnd";
import { createClub, uploadClubLogo } from "@/lib/firebase/callableService";
import { saveClubSetupObjectives } from "./retourUserService";

/** Encode un ArrayBuffer en base64 (payload callable logo). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Crée le club via la callable `createClub` : le fondateur y reçoit le
 * droit Administrateur (les droits ne s’écrivent que côté serveur). Logo et
 * objectifs suivent, sans bloquer la création.
 */
export async function createClubFromDraft(params: {
  founderUid: string;
  draft: ClubSetupDraft;
}): Promise<string> {
  const { clubId } = await createClub({
    name: params.draft.name.trim(),
    sport: params.draft.sport,
    city: formatCity(params.draft.city, { required: true }),
    postalCode: formatPostalCode(params.draft.postalCode),
    address: formatAddressLine(params.draft.address),
    description: params.draft.description.trim(),
    brandColorHex: params.draft.brandColorHex,
    practiceLocations: params.draft.practiceLocations.map((location) => ({
      name: location.name,
      ...(location.city ? { city: formatCity(location.city) } : {}),
      ...(location.address
        ? { address: formatAddressLine(location.address) }
        : {}),
      ...(location.category ? { category: location.category } : {}),
      ...(location.categoryCustom
        ? { categoryCustom: location.categoryCustom }
        : {}),
    })),
    seasonEndDateMs: defaultSeasonEndDate().getTime(),
  });
  const clubRef = { id: clubId };

  if (params.draft.logoDataUrl) {
    try {
      const parsed = dataUrlToBytes(params.draft.logoDataUrl);
      if (parsed) {
        await uploadClubLogo({
          clubId: clubRef.id,
          imageBase64: arrayBufferToBase64(parsed.bytes),
          contentType: parsed.contentType.startsWith("image/")
            ? parsed.contentType
            : "image/jpeg",
        });
      }
    } catch (error) {
      // Logo optionnel — ne bloque pas la création.
      Sentry.captureException(error, {
        level: "warning",
        tags: { feature: "club_setup", area: "logo_upload" },
        extra: { clubId: clubRef.id },
      });
    }
  }

  try {
    await saveClubSetupObjectives({
      userId: params.founderUid,
      clubId: clubRef.id,
      objectiveKeys: params.draft.objectives,
      clubName: params.draft.name.trim(),
      clubSport: params.draft.sport,
      memberCountRange: params.draft.memberCountRange,
    });
  } catch (error) {
    // retour_user optionnel si règles non déployées.
    Sentry.captureException(error, {
      level: "warning",
      tags: { feature: "club_setup", area: "retour_user" },
      extra: { clubId: clubRef.id, userId: params.founderUid },
    });
  }

  return clubRef.id;
}
