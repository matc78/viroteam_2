import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import {
  dataUrlToBytes,
  type ClubSetupDraft,
} from "@/lib/clubSetup/clubSetupDraft";
import { defaultSeasonEndDate } from "@/lib/planning/seasonEnd";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields, MemberRoles } from "@/lib/firebase/constants";
import {
  clubLogoStoragePath,
  uploadImageAtPath,
} from "@/lib/firebase/storage";
import type { ViroUserProfile } from "@/lib/firebase/types";
import { saveClubSetupObjectives } from "./retourUserService";

/** Crée un club Firestore à partir du brouillon wizard. */
export async function createClubFromDraft(params: {
  founderUid: string;
  founder: ViroUserProfile;
  draft: ClubSetupDraft;
}): Promise<string> {
  const firestore = getAppFirestore();
  const clubRef = doc(collection(firestore, Collections.clubs));
  const memberRef = doc(
    firestore,
    Collections.clubs,
    clubRef.id,
    Collections.members,
    params.founderUid,
  );
  const userRef = doc(firestore, Collections.users, params.founderUid);

  let logoUrl: string | null = null;
  if (params.draft.logoDataUrl) {
    try {
      const parsed = dataUrlToBytes(params.draft.logoDataUrl);
      if (parsed) {
        logoUrl = await uploadImageAtPath({
          path: clubLogoStoragePath(clubRef.id),
          bytes: parsed.bytes,
          contentType: parsed.contentType.startsWith("image/")
            ? parsed.contentType
            : "image/jpeg",
        });
      }
    } catch {
      // Logo optionnel — ne bloque pas la création.
    }
  }

  const displayName =
    params.founder.displayName.trim() ||
    [params.founder.firstName, params.founder.lastName].filter(Boolean).join(" ") ||
    params.founder.email;

  await runTransaction(firestore, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const userData = (userSnap.data() ?? {}) as Record<string, unknown>;
    const membershipsRaw = userData[Fields.clubMemberships];
    const memberships = Array.isArray(membershipsRaw)
      ? membershipsRaw.filter(
          (item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
        )
      : [];

    memberships.push({
      [Fields.clubId]: clubRef.id,
      [Fields.role]: MemberRoles.admin,
    });

    transaction.set(clubRef, {
      [Fields.name]: params.draft.name.trim(),
      [Fields.sport]: params.draft.sport,
      [Fields.city]: params.draft.city.trim(),
      [Fields.postalCode]: params.draft.postalCode.trim(),
      [Fields.address]: params.draft.address.trim(),
      ...(params.draft.description.trim()
        ? { [Fields.description]: params.draft.description.trim() }
        : {}),
      ...(logoUrl ? { [Fields.logoUrl]: logoUrl } : {}),
      [Fields.brandColorHex]: params.draft.brandColorHex,
      [Fields.practiceLocations]: params.draft.practiceLocations.map(
        (location) => ({
          name: location.name,
          ...(location.address ? { address: location.address } : {}),
        }),
      ),
      [Fields.adminIds]: [params.founderUid],
      [Fields.memberCount]: 1,
      [Fields.seasonEndDate]: Timestamp.fromDate(defaultSeasonEndDate()),
      [Fields.createdAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    });

    transaction.set(memberRef, {
      [Fields.memberId]: params.founderUid,
      [Fields.accountUid]: params.founderUid,
      [Fields.userId]: params.founderUid,
      [Fields.firstName]: params.founder.firstName,
      [Fields.lastName]: params.founder.lastName,
      [Fields.role]: MemberRoles.admin,
      [Fields.status]: "active",
      [Fields.teamIds]: [],
      [Fields.snapshot]: {
        [Fields.displayName]: displayName,
        [Fields.email]: params.founder.email,
        ...(params.founder.avatarUrl
          ? { [Fields.avatarUrl]: params.founder.avatarUrl }
          : {}),
      },
      [Fields.joinedAt]: serverTimestamp(),
      [Fields.updatedAt]: serverTimestamp(),
    });

    transaction.set(
      userRef,
      {
        [Fields.clubMemberships]: memberships,
        [Fields.flags]: {
          [Fields.profileCompleted]: true,
          [Fields.disabled]: false,
        },
        [Fields.updatedAt]: serverTimestamp(),
      },
      { merge: true },
    );
  });

  try {
    await saveClubSetupObjectives({
      userId: params.founderUid,
      clubId: clubRef.id,
      objectiveKeys: params.draft.objectives,
      clubName: params.draft.name.trim(),
      clubSport: params.draft.sport,
      memberCountRange: params.draft.memberCountRange,
    });
  } catch {
    // retour_user optionnel si règles non déployées.
  }

  return clubRef.id;
}
