import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  extractUrlsFromText,
  linkifyMessageText,
  segmentMessageText,
} from "./linkifyMessageText";

const MAPS = "https://www.google.com/maps/search/?api=1&query=";

describe("segmentMessageText", () => {
  it("texte vide → aucun segment ; texte brut → un segment", () => {
    expect(segmentMessageText("")).toEqual([]);
    expect(segmentMessageText("Rendez-vous au stade")).toEqual([
      { kind: "text", value: "Rendez-vous au stade" },
    ]);
  });

  it("URL http(s) au milieu, ponctuation finale exclue", () => {
    expect(segmentMessageText("Voir https://viroteam.fr/a?b=1. Merci")).toEqual([
      { kind: "text", value: "Voir " },
      {
        kind: "url",
        value: "https://viroteam.fr/a?b=1",
        href: "https://viroteam.fr/a?b=1",
      },
      { kind: "text", value: ". Merci" },
    ]);
  });

  it("URL entre parenthèses : la parenthèse fermante reste du texte", () => {
    expect(segmentMessageText("(http://ex.com/x)")).toEqual([
      { kind: "text", value: "(" },
      { kind: "url", value: "http://ex.com/x", href: "http://ex.com/x" },
      { kind: "text", value: ")" },
    ]);
  });

  it("www. → href préfixé https://", () => {
    expect(segmentMessageText("www.club.fr")).toEqual([
      { kind: "url", value: "www.club.fr", href: "https://www.club.fr" },
    ]);
  });

  it("plusieurs URLs", () => {
    expect(
      extractUrlsFromText("a https://a.fr b www.b.fr c HTTPS://C.FR/x"),
    ).toEqual(["https://a.fr", "https://www.b.fr", "HTTPS://C.FR/x"]);
  });

  it("adresse « n° + voie » → lien Maps", () => {
    expect(segmentMessageText("RDV : 12 rue des Lilas")).toEqual([
      { kind: "text", value: "RDV : " },
      {
        kind: "address",
        value: "12 rue des Lilas",
        href: `${MAPS}${encodeURIComponent("12 rue des Lilas")}`,
      },
    ]);
  });

  it("adresse « CP + ville » → lien Maps", () => {
    expect(segmentMessageText("Gymnase, 75011 Paris")).toEqual([
      { kind: "text", value: "Gymnase, " },
      {
        kind: "address",
        value: "75011 Paris",
        href: `${MAPS}${encodeURIComponent("75011 Paris")}`,
      },
    ]);
  });

  it("un motif d’adresse inclus dans une URL n’est pas doublé", () => {
    expect(
      segmentMessageText("https://ex.com/12 rue-x"),
    ).toEqual([
      { kind: "url", value: "https://ex.com/12", href: "https://ex.com/12" },
      { kind: "text", value: " rue-x" },
    ]);
    expect(extractUrlsFromText("https://ex.com/75011-paris")).toEqual([
      "https://ex.com/75011-paris",
    ]);
  });

  it("un nombre seul n’est pas une adresse", () => {
    expect(segmentMessageText("On était 12 à l’entraînement")).toEqual([
      { kind: "text", value: "On était 12 à l’entraînement" },
    ]);
  });
});

describe("extractUrlsFromText", () => {
  it("ignore les adresses et le texte", () => {
    expect(extractUrlsFromText("12 rue des Lilas")).toEqual([]);
    expect(extractUrlsFromText("")).toEqual([]);
  });
});

/** Enfants directs d’un élément React (fragment ou lien). */
function childrenOf(node: ReactNode): ReactNode[] {
  expect(isValidElement(node)).toBe(true);
  const children = (node as ReactElement<{ children?: ReactNode }>).props
    .children;
  return Array.isArray(children) ? children : [children];
}

describe("linkifyMessageText", () => {
  it("texte sans lien → chaîne brute", () => {
    expect(linkifyMessageText("")).toBe("");
    expect(linkifyMessageText("Salut")).toBe("Salut");
  });

  it("texte avec lien → fragment texte + <a> externe", () => {
    const parts = childrenOf(linkifyMessageText("Voir www.club.fr"));
    expect(parts).toHaveLength(2);
    expect(childrenOf(parts[0])).toEqual(["Voir "]);
    const link = parts[1] as ReactElement<Record<string, unknown>>;
    expect(link.type).toBe("a");
    expect(link.props).toMatchObject({
      href: "https://www.club.fr",
      target: "_blank",
      rel: "noopener noreferrer",
      className: "chatLink",
      children: "www.club.fr",
    });
  });
});
