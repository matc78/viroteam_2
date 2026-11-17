import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_PURGED_AT_FIELD,
  chatMediaDeletionTarget,
  deletedMessagePurgePatch,
  messageJustDeleted,
} from "./messageDeletion";

test("messageJustDeleted : seulement à la transition et une fois", () => {
  const at = { toMillis: () => 1 };
  assert.equal(messageJustDeleted({ text: "a" }, { text: "a", deletedAt: at }), true);
  assert.equal(messageJustDeleted({ deletedAt: at }, { deletedAt: at }), false);
  assert.equal(
    messageJustDeleted({}, { deletedAt: at, [CONTENT_PURGED_AT_FIELD]: at }),
    false,
  );
  assert.equal(messageJustDeleted({ text: "a" }, { text: "b" }), false);
  assert.equal(messageJustDeleted({ text: "a" }, undefined), false);
});

test("deletedMessagePurgePatch efface le contenu présent seulement", () => {
  const patch = deletedMessagePurgePatch(
    {
      type: "image",
      senderUid: "u1",
      text: "secret",
      downloadUrl: "https://x",
      thumbUrl: "https://y",
      replyToText: "cité",
      deletedAt: 1,
    },
    "DEL",
    "NOW",
  );
  assert.deepEqual(patch, {
    [CONTENT_PURGED_AT_FIELD]: "NOW",
    text: "DEL",
    downloadUrl: "DEL",
    thumbUrl: "DEL",
    replyToText: "DEL",
  });
});

test("chatMediaDeletionTarget cible l’image et sa miniature de la conversation", () => {
  const target = chatMediaDeletionTarget({
    clubId: "c1",
    conversationId: "v1",
    storagePath: "clubs/c1/chat/v1/u1/msg42.jpg",
  });
  assert.ok(target);
  assert.equal(target.prefix, "clubs/c1/chat/v1/u1/msg42");
  assert.equal(target.matches("clubs/c1/chat/v1/u1/msg42.jpg"), true);
  assert.equal(target.matches("clubs/c1/chat/v1/u1/msg42_thumb.png"), true);
  assert.equal(target.matches("clubs/c1/chat/v1/u1/msg420.jpg"), false);
  assert.equal(
    chatMediaDeletionTarget({
      clubId: "c1",
      conversationId: "v1",
      storagePath: "clubs/c2/chat/v1/u1/msg42.jpg",
    }),
    null,
  );
  assert.equal(
    chatMediaDeletionTarget({
      clubId: "c1",
      conversationId: "v1",
      storagePath: "clubs/c1/chat/v1/../../x.jpg",
    }),
    null,
  );
});
