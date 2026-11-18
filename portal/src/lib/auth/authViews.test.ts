import { describe, expect, it } from "vitest";
import {
  authHref,
  neighbourAuthView,
  parseAuthView,
  withAuthView,
} from "./authViews";

describe("parseAuthView", () => {
  it("retombe sur la connexion pour une valeur absente ou inconnue", () => {
    expect(parseAuthView(null)).toBe("login");
    expect(parseAuthView("")).toBe("login");
    expect(parseAuthView("admin")).toBe("login");
  });

  it("reconnaît les vues connues", () => {
    expect(parseAuthView("signup")).toBe("signup");
    expect(parseAuthView("code")).toBe("code");
  });
});

describe("authHref", () => {
  it("n’ajoute pas de paramètre pour la connexion seule", () => {
    expect(authHref("login")).toBe("/login");
  });

  it("encode la vue, l’intent et la page suivante", () => {
    expect(
      authHref("signup", { intent: "founder", next: "/join?code=AB12" }),
    ).toBe("/login?vue=signup&intent=founder&next=%2Fjoin%3Fcode%3DAB12");
  });
});

describe("withAuthView", () => {
  it("remplace la vue en conservant les autres paramètres", () => {
    expect(withAuthView("?next=%2Fhome&vue=code", "signup")).toBe(
      "?next=%2Fhome&vue=signup",
    );
  });

  it("retire la vue pour revenir à la connexion", () => {
    expect(withAuthView("?vue=code", "login")).toBe("");
    expect(withAuthView("next=%2Fhome&vue=code", "login")).toBe(
      "?next=%2Fhome",
    );
  });
});

describe("neighbourAuthView", () => {
  it("tourne de façon circulaire", () => {
    expect(neighbourAuthView("login", 1)).toBe("signup");
    expect(neighbourAuthView("login", -1)).toBe("code");
    expect(neighbourAuthView("signup", 1)).toBe("code");
    expect(neighbourAuthView("code", -1)).toBe("signup");
  });
});
