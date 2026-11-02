import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHAT_PREVIEW_MAX,
  ChatCopy,
  chatMessagePreviewText,
  chatPushContent,
  chatReplySnapshot,
  chatSenderNames,
  chatSenderRole,
  shouldAdvanceChatPreview,
} from "./preview";

describe("chatMessagePreviewText", () => {
  it("texte tronqué à la borne de l'aperçu", () => {
    assert.equal(chatMessagePreviewText({ type: "text", text: "  Salut  " }), "Salut");
    const long = chatMessagePreviewText({ type: "text", text: "x".repeat(500) });
    assert.equal(long.length, CHAT_PREVIEW_MAX);
    assert.ok(long.endsWith("…"));
  });

  it("photo, sondage et message supprimé ont un libellé fixe", () => {
    assert.equal(chatMessagePreviewText({ type: "image" }), ChatCopy.photo);
    assert.equal(
      chatMessagePreviewText({ type: "poll", pollQuestion: "Match samedi ?" }),
      "📊 Match samedi ?",
    );
    assert.equal(chatMessagePreviewText({ type: "poll" }), `📊 ${ChatCopy.pollFallback}`);
    assert.equal(
      chatMessagePreviewText({ type: "text", text: "Oups", deletedAt: new Date() }),
      ChatCopy.deleted,
    );
  });
});

describe("chatReplySnapshot", () => {
  it("fige le texte et l'auteur du message cité", () => {
    assert.deepEqual(chatReplySnapshot({ type: "text", text: "On joue où ?", senderUid: "u1" }), {
      replyToText: "On joue où ?",
      replyToSenderUid: "u1",
    });
  });

  it("message cité absent ou supprimé → pas de citation", () => {
    assert.equal(chatReplySnapshot(undefined), null);
    assert.equal(
      chatReplySnapshot({ type: "text", text: "x", senderUid: "u1", deletedAt: new Date() }),
      null,
    );
    assert.equal(chatReplySnapshot({ type: "text", text: "x" }), null);
  });
});

describe("shouldAdvanceChatPreview", () => {
  it("n'écrase pas un aperçu plus récent (trigger livré en retard)", () => {
    assert.equal(shouldAdvanceChatPreview(2000, null), true);
    assert.equal(shouldAdvanceChatPreview(2000, 1000), true);
    assert.equal(shouldAdvanceChatPreview(2000, 2000), true);
    assert.equal(shouldAdvanceChatPreview(1000, 2000), false);
  });
});

describe("chatSenderRole / chatSenderNames", () => {
  it("rôle inconnu ou absent → parent", () => {
    assert.equal(chatSenderRole("coach"), "coach");
    assert.equal(chatSenderRole(undefined), "parent");
    assert.equal(chatSenderRole("superadmin"), "parent");
  });

  it("prénom depuis firstName, sinon displayName", () => {
    assert.deepEqual(chatSenderNames({ firstName: "Paul", lastName: "Martin" }), {
      firstName: "Paul",
      fullName: "Paul Martin",
    });
    assert.deepEqual(chatSenderNames({ displayName: "Léa Durand" }), {
      firstName: "Léa",
      fullName: "Léa Durand",
    });
    assert.deepEqual(chatSenderNames(undefined), { firstName: "", fullName: "" });
  });
});

describe("chatPushContent", () => {
  const names = { senderFirstName: "Paul", senderFullName: "Paul Martin", preview: "Salut" };

  it("DM 1:1 : titre = expéditeur, corps sans préfixe", () => {
    assert.deepEqual(
      chatPushContent({
        conversation: { type: "dm", title: "Coach", participantUids: ["a", "b"] },
        ...names,
      }),
      { title: "Paul Martin", body: "Salut" },
    );
  });

  it("groupe : titre = conversation, corps préfixé du prénom", () => {
    assert.deepEqual(
      chatPushContent({
        conversation: { type: "team", title: "U13", participantUids: ["a", "b", "c"] },
        ...names,
      }),
      { title: "U13", body: "Paul : Salut" },
    );
    assert.deepEqual(
      chatPushContent({
        conversation: { type: "team", title: "U13", titleOverride: "Les Bleus" },
        ...names,
        preview: "",
      }),
      { title: "Les Bleus", body: `Paul : ${ChatCopy.newMessage}` },
    );
  });
});
