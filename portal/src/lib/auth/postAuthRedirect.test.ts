import { describe, expect, it } from "vitest";
import {
  buildLoginRedirect,
  classifyNextPath,
  familyEquivalentPath,
  isSafeRedirect,
  resolveNextRedirect,
} from "./postAuthRedirect";

const bureau = { isBureauUser: true, isParent: false };
const parentOnly = { isBureauUser: false, isParent: true };
const nobody = { isBureauUser: false, isParent: false };

describe("isSafeRedirect", () => {
  it("accepte les chemins internes, query comprise", () => {
    expect(isSafeRedirect("/home")).toBe(true);
    expect(isSafeRedirect("/messages?conversationId=abc&clubId=c1")).toBe(true);
  });

  it("refuse les redirections externes ou ambiguës", () => {
    expect(isSafeRedirect(null)).toBe(false);
    expect(isSafeRedirect("")).toBe(false);
    expect(isSafeRedirect("https://evil.example")).toBe(false);
    expect(isSafeRedirect("//evil.example")).toBe(false);
    expect(isSafeRedirect("/\\evil.example")).toBe(false);
    expect(isSafeRedirect("/\t/evil.example")).toBe(false);
    expect(isSafeRedirect("javascript:alert(1)")).toBe(false);
  });
});

describe("buildLoginRedirect", () => {
  it("conserve la query string dans next", () => {
    expect(buildLoginRedirect("/fees", "?clubId=c1")).toBe(
      `/login?next=${encodeURIComponent("/fees?clubId=c1")}`,
    );
    expect(buildLoginRedirect("/planning", "eventId=e1")).toBe(
      `/login?next=${encodeURIComponent("/planning?eventId=e1")}`,
    );
  });

  it("n’ajoute pas de ? sans query", () => {
    expect(buildLoginRedirect("/home", "")).toBe("/login?next=%2Fhome");
  });
});

describe("classifyNextPath", () => {
  it("reconnaît messagerie et journal comme routes bureau", () => {
    expect(classifyNextPath("/messages?conversationId=x")).toBe("bureau");
    expect(classifyNextPath("/activity")).toBe("bureau");
  });

  it("ne confond pas un préfixe partiel", () => {
    expect(classifyNextPath("/messagesX")).toBe("other");
    expect(classifyNextPath("/family-evil")).toBe("other");
    expect(classifyNextPath("/family/fees?clubId=c1")).toBe("family");
    expect(classifyNextPath("/join?code=ABC")).toBe("join");
  });
});

describe("familyEquivalentPath", () => {
  it("garde tous les paramètres pour la messagerie", () => {
    expect(
      familyEquivalentPath(
        "/messages",
        new URLSearchParams("conversationId=x&clubId=c1"),
      ),
    ).toBe("/family/messages?conversationId=x&clubId=c1");
  });

  it("ne transmet que les paramètres utiles ailleurs", () => {
    expect(
      familyEquivalentPath(
        "/planning",
        new URLSearchParams("clubId=c1&memberId=m1&eventId=e1&teams=all"),
      ),
    ).toBe("/family/planning?clubId=c1&memberId=m1&eventId=e1");
    expect(
      familyEquivalentPath("/fees", new URLSearchParams("clubId=c1")),
    ).toBe("/family/fees?clubId=c1");
  });

  it("renvoie null sans équivalent famille", () => {
    expect(familyEquivalentPath("/members", new URLSearchParams())).toBeNull();
  });
});

describe("resolveNextRedirect", () => {
  it("renvoie le deep link complet au bureau", () => {
    expect(
      resolveNextRedirect("/messages?conversationId=x", bureau),
    ).toBe("/messages?conversationId=x");
    expect(resolveNextRedirect("/activity", bureau)).toBe("/activity");
  });

  it("convertit un lien bureau pour un parent sans fiche", () => {
    expect(resolveNextRedirect("/fees?clubId=c1", parentOnly)).toBe(
      "/family/fees?clubId=c1",
    );
    expect(resolveNextRedirect("/members", parentOnly)).toBeNull();
  });

  it("refuse l’espace famille sans lien parent", () => {
    expect(resolveNextRedirect("/family/fees", bureau)).toBeNull();
    expect(resolveNextRedirect("/family/fees", parentOnly)).toBe(
      "/family/fees",
    );
  });

  it("laisse passer join et club-setup pour tout compte", () => {
    expect(resolveNextRedirect("/join?code=ABC", nobody)).toBe(
      "/join?code=ABC",
    );
    expect(resolveNextRedirect("/club-setup", nobody)).toBe("/club-setup");
  });

  it("ignore les destinations non sûres", () => {
    expect(resolveNextRedirect("//evil.example/home", bureau)).toBeNull();
    expect(resolveNextRedirect("https://evil.example", bureau)).toBeNull();
  });
});
