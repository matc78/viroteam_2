import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { excelFileToCsvText } from "./membersExcel";

/**
 * Construit un File .xlsx minimal à partir de lignes de cellules.
 */
async function buildXlsxFile(rows: string[][]): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Membres");
  worksheet.addRows(rows);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], "membres.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("excelFileToCsvText", () => {
  it("convertit la 1ʳᵉ feuille en CSV", async () => {
    const file = await buildXlsxFile([
      ["firstName", "lastName", "role"],
      ["Alice", "Dupont", "player"],
    ]);
    const csv = await excelFileToCsvText(file);
    expect(csv).toContain("firstName,lastName,role");
    expect(csv).toContain("Alice,Dupont,player");
  });

  it("échappe les virgules dans les cellules", async () => {
    const file = await buildXlsxFile([
      ["firstName", "team"],
      ["Alice", "U13, A"],
    ]);
    const csv = await excelFileToCsvText(file);
    expect(csv).toContain('"U13, A"');
  });
});
