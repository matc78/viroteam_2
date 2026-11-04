import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatChatDateSeparator,
  isSameCalendarDay,
} from "./formatChatDateSeparator";

describe("formatChatDateSeparator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mardi 3 novembre 2026, 10:00 (heure locale).
    vi.setSystemTime(new Date(2026, 10, 3, 10, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aujourd’hui, quelle que soit l’heure", () => {
    expect(formatChatDateSeparator(new Date(2026, 10, 3, 0, 1))).toBe(
      "Aujourd'hui",
    );
    expect(formatChatDateSeparator(new Date(2026, 10, 3, 23, 59))).toBe(
      "Aujourd'hui",
    );
  });

  it("hier", () => {
    expect(formatChatDateSeparator(new Date(2026, 10, 2, 23, 59))).toBe("Hier");
  });

  it("même année : jour + date longue, majuscule initiale, sans année", () => {
    expect(formatChatDateSeparator(new Date(2026, 9, 28, 18, 0))).toBe(
      "Mercredi 28 octobre",
    );
  });

  it("autre année : l’année est ajoutée", () => {
    expect(formatChatDateSeparator(new Date(2025, 11, 25, 9, 0))).toBe(
      "Jeudi 25 décembre 2025",
    );
  });

  it("date future (horloge décalée) : date longue, pas « Aujourd'hui »", () => {
    expect(formatChatDateSeparator(new Date(2026, 10, 4, 8, 0))).toBe(
      "Mercredi 4 novembre",
    );
  });

  it("lendemain d’un changement d’heure : toujours « Hier »", () => {
    vi.setSystemTime(new Date(2026, 2, 30, 10, 0));
    expect(formatChatDateSeparator(new Date(2026, 2, 29, 12, 0))).toBe("Hier");
    vi.setSystemTime(new Date(2026, 9, 26, 10, 0));
    expect(formatChatDateSeparator(new Date(2026, 9, 25, 12, 0))).toBe("Hier");
  });
});

describe("isSameCalendarDay", () => {
  it("même jour à des heures différentes", () => {
    expect(
      isSameCalendarDay(new Date(2026, 10, 3, 0, 0), new Date(2026, 10, 3, 23, 59)),
    ).toBe(true);
  });

  it("jours, mois ou années différents", () => {
    expect(
      isSameCalendarDay(new Date(2026, 10, 3, 23, 59), new Date(2026, 10, 4, 0, 0)),
    ).toBe(false);
    expect(
      isSameCalendarDay(new Date(2026, 9, 3), new Date(2026, 10, 3)),
    ).toBe(false);
    expect(
      isSameCalendarDay(new Date(2025, 10, 3), new Date(2026, 10, 3)),
    ).toBe(false);
  });
});
