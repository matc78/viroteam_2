import { describe, expect, it } from "vitest";
import { makeMessage } from "./chatTestFixtures";
import {
  appendOlderPage,
  findThreadSearchMatches,
  incomingMessageToAnnounce,
  mergeThreadMessages,
  messageTimeLabel,
  replyPayloadFromTarget,
  replyPreviewText,
} from "./threadMessages";

const at = (hour: number) => new Date(2026, 10, 3, hour, 5);

describe("replyPreviewText", () => {
  it("texte trimé ; texte absent → chaîne vide", () => {
    expect(replyPreviewText(makeMessage({ text: "  Salut  " }))).toBe("Salut");
    expect(replyPreviewText(makeMessage({ text: null }))).toBe("");
  });

  it("photo → « Photo »", () => {
    expect(replyPreviewText(makeMessage({ type: "image", text: null }))).toBe(
      "Photo",
    );
  });

  it("sondage → question, sinon texte, sinon « Sondage »", () => {
    expect(
      replyPreviewText(
        makeMessage({ type: "poll", pollQuestion: "Dispo ?", text: "x" }),
      ),
    ).toBe("Dispo ?");
    expect(
      replyPreviewText(makeMessage({ type: "poll", pollQuestion: null, text: "x" })),
    ).toBe("x");
    expect(
      replyPreviewText(makeMessage({ type: "poll", pollQuestion: "", text: null })),
    ).toBe("Sondage");
  });
});

describe("replyPayloadFromTarget", () => {
  it("pas de cible, cible supprimée ou sans texte → aucun champ", () => {
    expect(replyPayloadFromTarget(null)).toEqual({});
    expect(replyPayloadFromTarget(makeMessage({ deletedAt: at(9) }))).toEqual({});
    expect(replyPayloadFromTarget(makeMessage({ text: "   " }))).toEqual({});
  });

  it("citation : id, extrait (240 car. max) et auteur", () => {
    expect(
      replyPayloadFromTarget(makeMessage({ id: "m9", text: " Salut ", senderUid: "u2" })),
    ).toEqual({ replyToMessageId: "m9", replyToText: "Salut", replyToSenderUid: "u2" });
    const long = replyPayloadFromTarget(makeMessage({ text: "x".repeat(300) }));
    expect(long.replyToText).toHaveLength(240);
    expect(
      replyPayloadFromTarget(makeMessage({ type: "image", text: null })).replyToText,
    ).toBe("Photo");
  });
});

describe("messageTimeLabel", () => {
  it("heure seule, préfixée « modifié » si édité", () => {
    expect(messageTimeLabel(makeMessage({ createdAt: at(14) }))).toBe("14:05");
    expect(
      messageTimeLabel(makeMessage({ createdAt: at(9), editedAt: at(10) })),
    ).toBe("modifié 09:05");
  });
});

describe("mergeThreadMessages", () => {
  it("dédoublonne (temps réel prioritaire) et trie chronologiquement", () => {
    const merged = mergeThreadMessages(
      [
        makeMessage({ id: "b", createdAt: at(9), text: "ancien" }),
        makeMessage({ id: "a", createdAt: at(8) }),
      ],
      [
        makeMessage({ id: "c", createdAt: at(10) }),
        makeMessage({ id: "b", createdAt: at(9), text: "à jour" }),
      ],
    );
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(merged[1]!.text).toBe("à jour");
  });

  it("listes vides → vide", () => {
    expect(mergeThreadMessages([], [])).toEqual([]);
  });
});

describe("appendOlderPage", () => {
  it("ajoute sans doublon (l’existant gagne) et trie, sans muter l’entrée", () => {
    const current = [makeMessage({ id: "b", createdAt: at(9), text: "garde" })];
    const merged = appendOlderPage(current, [
      makeMessage({ id: "a", createdAt: at(8) }),
      makeMessage({ id: "b", createdAt: at(9), text: "ignoré" }),
    ]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
    expect(merged[1]!.text).toBe("garde");
    expect(current).toHaveLength(1);
  });
});

describe("findThreadSearchMatches", () => {
  const messages = [
    makeMessage({ id: "t", text: "Match samedi à 10h" }),
    makeMessage({ id: "p", type: "poll", text: null, pollQuestion: "Qui vient au MATCH ?" }),
    makeMessage({ id: "d", text: "match supprimé", deletedAt: at(12) }),
    makeMessage({ id: "i", type: "image", text: null }),
  ];

  it("recherche vide ou blanche → aucun résultat", () => {
    expect(findThreadSearchMatches(messages, "")).toEqual([]);
    expect(findThreadSearchMatches(messages, "   ")).toEqual([]);
  });

  it("texte et question de sondage, sans casse, hors messages supprimés", () => {
    expect(findThreadSearchMatches(messages, " match ")).toEqual(["t", "p"]);
  });

  it("aucune correspondance", () => {
    expect(findThreadSearchMatches(messages, "tournoi")).toEqual([]);
  });
});

describe("incomingMessageToAnnounce", () => {
  const first = makeMessage({ id: "m1", senderUid: "other" });
  const incoming = makeMessage({ id: "m2", senderUid: "other" });

  it("annonce le nouveau dernier message d’un autre membre", () => {
    expect(
      incomingMessageToAnnounce({
        previousLastId: "m1",
        messages: [first, incoming],
        viewerUid: "me",
      }),
    ).toBe(incoming);
  });

  it("annonce aussi le premier message d’un fil vide", () => {
    expect(
      incomingMessageToAnnounce({
        previousLastId: null,
        messages: [incoming],
        viewerUid: "me",
      }),
    ).toBe(incoming);
  });

  it("rien au premier chargement ni au chargement de l’historique", () => {
    expect(
      incomingMessageToAnnounce({
        previousLastId: undefined,
        messages: [first, incoming],
        viewerUid: "me",
      }),
    ).toBeNull();
    expect(
      incomingMessageToAnnounce({
        previousLastId: "m2",
        messages: [makeMessage({ id: "m0" }), first, incoming],
        viewerUid: "me",
      }),
    ).toBeNull();
  });

  it("rien pour mes messages ni un message supprimé", () => {
    expect(
      incomingMessageToAnnounce({
        previousLastId: "m1",
        messages: [first, makeMessage({ id: "m2", senderUid: "me" })],
        viewerUid: "me",
      }),
    ).toBeNull();
    expect(
      incomingMessageToAnnounce({
        previousLastId: "m1",
        messages: [
          first,
          makeMessage({
            id: "m2",
            senderUid: "other",
            deletedAt: new Date(2026, 10, 3, 11, 0),
          }),
        ],
        viewerUid: "me",
      }),
    ).toBeNull();
  });
});
