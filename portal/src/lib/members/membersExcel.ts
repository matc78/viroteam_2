import type ExcelJS from "exceljs";

/** `exceljs` n’est chargé qu’au moment d’un import / export Excel. */
const loadExcelJs = () => import("exceljs");

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
 * Échappe une valeur pour une cellule CSV (guillemets si virgule / guillemet / saut de ligne).
 */
function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convertit une feuille ExcelJS en texte CSV (séparateur `,`, fin de ligne `\n`).
 */
function worksheetToCsv(worksheet: ExcelJS.Worksheet): string {
  const columnCount = Math.max(worksheet.columnCount, 1);
  const lines: string[] = [];
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      const text =
        cell.text !== undefined && cell.text !== ""
          ? cell.text
          : cell.value == null
            ? ""
            : String(cell.value);
      cells.push(escapeCsvCell(text));
    }
    lines.push(cells.join(","));
  });
  return lines.join("\n");
}

/**
 * Lit un fichier Excel (.xlsx) et renvoie le contenu de la 1ʳᵉ feuille
 * en texte CSV (pour `buildMembersImportPlan`).
 */
export async function excelFileToCsvText(file: File): Promise<string> {
  const [buffer, excelModule] = await Promise.all([
    file.arrayBuffer(),
    loadExcelJs(),
  ]);
  const workbook = new excelModule.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error(
      "Fichier Excel illisible : aucune feuille trouvée. Corrigez le fichier puis réessayez.",
    );
  }
  const csv = worksheetToCsv(worksheet);
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
export async function downloadMembersExcelTemplate(params?: {
  categoryExample?: string;
}): Promise<void> {
  const excelModule = await loadExcelJs();
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

  const workbook = new excelModule.Workbook();
  const worksheet = workbook.addWorksheet("Membres");
  worksheet.addRows(rows);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = "modele-membres-viroteam.xlsx";
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
