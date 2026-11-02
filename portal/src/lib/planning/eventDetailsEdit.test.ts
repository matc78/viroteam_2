import { describe, expect, it } from "vitest";
import {
  buildEventDetailsPatch,
  validateEventDetails,
  type EditableEventDetails,
} from "./eventDetailsEdit";

const training: EditableEventDetails = {
  type: "training",
  title: "Entraînement - Senior 1",
  day: "2026-11-10",
  startTime: "18:00",
  endTime: "19:30",
  meetingTime: null,
  location: "Gymnase Jean Moulin",
  meetingLocation: null,
};

describe("buildEventDetailsPatch", () => {
  it("ne renvoie rien si rien n'a changé (espaces compris)", () => {
    expect(
      buildEventDetailsPatch(training, {
        ...training,
        location: "  Gymnase Jean Moulin ",
      }),
    ).toEqual({});
  });

  it("ne garde que les champs modifiés", () => {
    expect(
      buildEventDetailsPatch(training, {
        ...training,
        day: "2026-11-12",
        startTime: "19:00",
        endTime: "20:30",
      }),
    ).toEqual({ day: "2026-11-12", startTime: "19:00", endTime: "20:30" });
  });

  it("ignore le titre d'un événement d'équipe", () => {
    expect(
      buildEventDetailsPatch(training, { ...training, title: "Autre chose" }),
    ).toEqual({});
  });

  it("écrit le titre libre d'une réunion", () => {
    const meeting = { ...training, type: "meeting" as const, title: "AG" };
    expect(
      buildEventDetailsPatch(meeting, { ...meeting, title: " AG annuelle " }),
    ).toEqual({ title: "AG annuelle" });
  });

  it("supprime un lieu de RDV vidé", () => {
    const match: EditableEventDetails = {
      ...training,
      type: "match",
      endTime: null,
      meetingTime: "13:30",
      meetingLocation: "Parking du stade",
    };
    expect(
      buildEventDetailsPatch(match, { ...match, meetingLocation: "  " }),
    ).toEqual({ meetingLocation: null });
  });
});

describe("validateEventDetails", () => {
  it("accepte un formulaire complet", () => {
    expect(validateEventDetails(training)).toBeNull();
  });

  it("refuse une fin avant le début", () => {
    expect(validateEventDetails({ ...training, endTime: "17:00" })).toMatch(
      /fin/,
    );
  });

  it("exige un lieu", () => {
    expect(validateEventDetails({ ...training, location: " " })).toMatch(
      /lieu/,
    );
  });

  it("exige le titre d'un événement « autre »", () => {
    expect(
      validateEventDetails({ ...training, type: "other", title: "" }),
    ).toMatch(/titre/);
  });
});
