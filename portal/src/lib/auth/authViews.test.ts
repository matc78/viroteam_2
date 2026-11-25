import { describe, expect, it } from "vitest";
import {
  authHref,
  neighbourAuthView,
  swipeTargetAuthView,
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

describe("swipeTargetAuthView", () => {
  const width = 300;

  it("passe à la carte voisine sur un glissé assez long", () => {
    expect(swipeTargetAuthView("login", -80, 0.1, width)).toBe("signup");
    expect(swipeTargetAuthView("login", 80, 0.1, width)).toBe("code");
  });

  it("passe à la voisine sur un lancer rapide mais court", () => {
    expect(swipeTargetAuthView("login", -30, -0.8, width)).toBe("signup");
    expect(swipeTargetAuthView("login", 30, 0.8, width)).toBe("code");
  });

  it("reste sur place pour un glissé court et lent", () => {
    expect(swipeTargetAuthView("login", -30, -0.1, width)).toBe("login");
    expect(swipeTargetAuthView("login", 5, 2, width)).toBe("login");
  });

  it("ignore un lancer à contresens du glissé", () => {
    expect(swipeTargetAuthView("login", -30, 0.8, width)).toBe("login");
  });

  it("ne boucle pas aux extrémités et n’avance que d’une carte", () => {
    expect(swipeTargetAuthView("code", 250, 2, width)).toBe("code");
    expect(swipeTargetAuthView("signup", -250, -2, width)).toBe("signup");
    expect(swipeTargetAuthView("code", -290, -3, width)).toBe("login");
  });
});
