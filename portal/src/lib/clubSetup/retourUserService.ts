import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ClubObjectives } from "@/lib/clubSetup/constants";
import { getAppFirestore } from "@/lib/firebase/app";
import { Collections, Fields } from "@/lib/firebase/constants";

export const RETOUR_USER_TYPE_CLUB_SETUP_OBJECTIVES = "club_setup_objectives";

/** Enregistre les objectifs choisis à la création d’un club. */
export async function saveClubSetupObjectives(params: {
  userId: string;
  clubId: string;
  objectiveKeys: Set<string>;
  clubName?: string;
  clubSport?: string;
  memberCountRange?: string | null;
}): Promise<void> {
  if (params.objectiveKeys.size === 0) return;

  const labels = [...params.objectiveKeys].map((key) => ClubObjectives.label(key));

  await addDoc(collection(getAppFirestore(), Collections.retourUser), {
    [Fields.userId]: params.userId,
    [Fields.clubId]: params.clubId,
    [Fields.type]: RETOUR_USER_TYPE_CLUB_SETUP_OBJECTIVES,
    ...(params.clubName ? { [Fields.clubName]: params.clubName } : {}),
    ...(params.clubSport ? { [Fields.clubSport]: params.clubSport } : {}),
    [Fields.objectives]: [...params.objectiveKeys],
    [Fields.objectivesLabels]: labels,
    ...(params.memberCountRange
      ? { [Fields.memberCountRange]: params.memberCountRange }
      : {}),
    [Fields.createdAt]: serverTimestamp(),
  });
}
