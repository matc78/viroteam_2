import * as XLSX from "xlsx";
import { membersCsvTemplate } from "@/lib/members/membersCsv";

const TEMPLATE_HEADERS = [
  "firstName",
  "lastName",
  "role",
  "email",
  "license",
  "team",
  "category",
] as const;

/**
 * Lit un fichier Excel (.xlsx / .xls) et renvoie le contenu de la 1ʳᵉ feuille
 * en texte CSV (pour `buildMembersImportPlan`).
 */
export async function excelFileToCsvText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(
      "Fichier Excel illisible : aucune feuille trouvée. Corrigez le fichier puis réessayez.",
    );
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new Error(
      "Fichier Excel illisible : feuille introuvable. Corrigez le fichier puis réessayez.",
    );
  }
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ",", RS: "\n" });
  if (!csv.trim()) {
    throw new Error(
      "Fichier Excel vide. Remplissez la 1ʳᵉ feuille puis réessayez.",
    );
  }
  return csv;
}

/**
 * Télécharge un modèle Excel (.xlsx) avec les colonnes d’import membres.
 */
export function downloadMembersExcelTemplate(params?: {
  categoryExample?: string;
}): void {
  const category = params?.categoryExample?.trim() || "U13";
  const rows: string[][] = [
    [...TEMPLATE_HEADERS],
    [
      "Alice",
      "Dupont",
      "player",
      "alice@example.com",
      "LIC-001",
      "U13 A",
      category,
    ],
    ["Bob", "Martin", "coach", "bob@example.com", "", "U13 A", category],
    ["Claire", "Bureau", "admin", "claire@example.com", "", "", ""],
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Membres");
  XLSX.writeFile(workbook, "modele-membres-viroteam.xlsx");
}
