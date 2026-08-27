import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getAppFirestore } from "./app";
import {
  Collections,
  EquipmentConditions,
  Fields,
  type EquipmentCondition,
} from "./constants";
import { toDate } from "./types";

/** Item d’inventaire club. */
export type EquipmentItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: EquipmentCondition;
  location: string;
  assignedTeamId: string | null;
  notes: string;
  updatedAt: Date | null;
  updatedBy: string | null;
};

/** Payload création / édition inventaire. */
export type EquipmentItemInput = {
  name: string;
  category: string;
  quantity: number;
  condition: EquipmentCondition;
  location?: string;
  assignedTeamId?: string | null;
  notes?: string;
};

function equipmentCol(clubId: string) {
  return collection(
    getAppFirestore(),
    Collections.clubs,
    clubId,
    Collections.equipment,
  );
}

function parseCondition(raw: unknown): EquipmentCondition {
  const value = String(raw ?? "").trim();
  if (
    value === EquipmentConditions.ok ||
    value === EquipmentConditions.use ||
    value === EquipmentConditions.hs
  ) {
    return value;
  }
  return EquipmentConditions.ok;
}

/** Parse un document equipment/{itemId}. */
export function parseEquipmentItem(
  id: string,
  data: Record<string, unknown>,
): EquipmentItem {
  return {
    id,
    name: String(data[Fields.name] ?? "").trim(),
    category: String(data[Fields.category] ?? "").trim(),
    quantity: Math.max(0, Number(data[Fields.quantity] ?? 0)),
    condition: parseCondition(data[Fields.condition]),
    location: String(data[Fields.location] ?? "").trim(),
    assignedTeamId: String(data[Fields.assignedTeamId] ?? "").trim() || null,
    notes: String(data[Fields.notes] ?? "").trim(),
    updatedAt: toDate(data[Fields.updatedAt]),
    updatedBy: String(data[Fields.updatedBy] ?? "").trim() || null,
  };
}

/** Liste les items d’inventaire du club (tri nom). */
export async function listEquipmentItems(
  clubId: string,
): Promise<EquipmentItem[]> {
  const snap = await getDocs(equipmentCol(clubId));
  const items = snap.docs.map((document) =>
    parseEquipmentItem(document.id, document.data() as Record<string, unknown>),
  );
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return items;
}

/** Crée un item d’inventaire. */
export async function createEquipmentItem(params: {
  clubId: string;
  uid: string;
  input: EquipmentItemInput;
}): Promise<string> {
  const name = params.input.name.trim();
  if (!name) throw new Error("Le nom est requis.");
  const category = params.input.category.trim();
  if (!category) throw new Error("La catégorie est requise.");
  const quantity = Math.max(0, Math.floor(params.input.quantity));

  const ref = await addDoc(equipmentCol(params.clubId), {
    [Fields.name]: name,
    [Fields.category]: category,
    [Fields.quantity]: quantity,
    [Fields.condition]: params.input.condition,
    [Fields.location]: params.input.location?.trim() ?? "",
    [Fields.assignedTeamId]: params.input.assignedTeamId?.trim() || null,
    [Fields.notes]: params.input.notes?.trim() ?? "",
    [Fields.updatedBy]: params.uid,
    [Fields.createdAt]: serverTimestamp(),
    [Fields.updatedAt]: serverTimestamp(),
  });
  return ref.id;
}

/** Met à jour un item d’inventaire. */
export async function updateEquipmentItem(params: {
  clubId: string;
  itemId: string;
  uid: string;
  input: EquipmentItemInput;
}): Promise<void> {
  const name = params.input.name.trim();
  if (!name) throw new Error("Le nom est requis.");
  const category = params.input.category.trim();
  if (!category) throw new Error("La catégorie est requise.");
  const quantity = Math.max(0, Math.floor(params.input.quantity));

  await updateDoc(
    doc(getAppFirestore(), Collections.clubs, params.clubId, Collections.equipment, params.itemId),
    {
      [Fields.name]: name,
      [Fields.category]: category,
      [Fields.quantity]: quantity,
      [Fields.condition]: params.input.condition,
      [Fields.location]: params.input.location?.trim() ?? "",
      [Fields.assignedTeamId]: params.input.assignedTeamId?.trim() || null,
      [Fields.notes]: params.input.notes?.trim() ?? "",
      [Fields.updatedBy]: params.uid,
      [Fields.updatedAt]: serverTimestamp(),
    },
  );
}

/** Supprime un item d’inventaire. */
export async function deleteEquipmentItem(params: {
  clubId: string;
  itemId: string;
}): Promise<void> {
  await deleteDoc(
    doc(
      getAppFirestore(),
      Collections.clubs,
      params.clubId,
      Collections.equipment,
      params.itemId,
    ),
  );
}

/** Libellé FR d’un état inventaire. */
export function equipmentConditionLabel(condition: EquipmentCondition): string {
  if (condition === EquipmentConditions.use) return "Usé";
  if (condition === EquipmentConditions.hs) return "HS";
  return "OK";
}
