import { describe, expect, it } from "vitest";
import { chatCopy } from "@/lib/copy/chatCopy";
import { ChatWritePolicies } from "./constants";
import { readonlyHintFor, type ChatConversation } from "./chatTypes";

function conversationWith(writePolicy: string): ChatConversation {
  return { writePolicy } as ChatConversation;
}

describe("readonlyHintFor", () => {
  it("annonce les admins seuls sur un canal admins_only", () => {
    expect(
      readonlyHintFor(conversationWith(ChatWritePolicies.adminsOnly)),
    ).toBe(chatCopy.readonlyAdminsOnly);
  });

  it("annonce coachs et admins sur un canal coaches_and_admins", () => {
    expect(
      readonlyHintFor(conversationWith(ChatWritePolicies.coachesAndAdmins)),
    ).toBe(chatCopy.readonlyCoachesAndAdmins);
  });

  it("n’affiche rien pour une conversation ouverte ou pas encore chargée", () => {
    expect(readonlyHintFor(conversationWith(ChatWritePolicies.open))).toBeNull();
    expect(readonlyHintFor(null)).toBeNull();
  });
});
