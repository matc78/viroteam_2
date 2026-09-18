import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml } from "../brevo";
import { buildGuyEmail, normalizeMemberInviteRole } from "./guyCopy";
import { APP_LOGO_URL, wrapGuyEmailLayout } from "./layout";

test("normalizeMemberInviteRole mappe coach/admin/player", () => {
  assert.equal(normalizeMemberInviteRole("coach"), "coach");
  assert.equal(normalizeMemberInviteRole("ADMIN"), "admin");
  assert.equal(normalizeMemberInviteRole("player"), "player");
  assert.equal(normalizeMemberInviteRole("autre"), "player");
});

test("memberInvite player : sujet Guy + code + CTA + logos", () => {
  const mail = buildGuyEmail({
    kind: "memberInvite",
    clubId: "club1",
    clubName: "AS Volley",
    clubLogoUrl: "https://cdn.example.com/club.png",
    role: "player",
    firstName: "Léa",
    code: "AB12CD",
    joinUrl: "https://www.viroteam.com/join?code=AB12CD",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.viroteam.viro_team",
  });

  assert.match(mail.subject, /Allez, rejoins AS Volley/);
  assert.match(mail.subject, /Guy/);
  assert.match(mail.textContent, /AB12CD/);
  assert.match(mail.textContent, /Léa/);
  assert.match(mail.htmlContent, /AB12CD/);
  assert.match(mail.htmlContent, /Ouvrir l'invitation/);
  assert.match(mail.htmlContent, /cdn\.example\.com\/club\.png/);
  assert.ok(mail.htmlContent.includes(APP_LOGO_URL));
  assert.match(mail.htmlContent, /Guy, du club via ViroTeam/);
  assert.ok(mail.tags.includes("member-invite"));
  assert.ok(mail.tags.includes("player"));
});

test("memberInvite coach / admin : sujets distincts", () => {
  const coach = buildGuyEmail({
    kind: "memberInvite",
    clubId: "c",
    clubName: "RC Nantes",
    role: "coach",
    firstName: "",
    code: "ZZ99YY",
    joinUrl: "https://www.viroteam.com/join?code=ZZ99YY",
  });
  const admin = buildGuyEmail({
    kind: "memberInvite",
    clubId: "c",
    clubName: "RC Nantes",
    role: "admin",
    firstName: "Marc",
    code: "ZZ99YY",
    joinUrl: "https://www.viroteam.com/join?code=ZZ99YY",
  });
  assert.match(coach.subject, /besoin de toi — RC Nantes/);
  assert.match(admin.subject, /clés — RC Nantes/);
  assert.match(admin.textContent, /Marc/);
  assert.match(admin.textContent, /tu gères RC Nantes/);
});

test("noms de club sans préposition (USMV / association)", () => {
  const mail = buildGuyEmail({
    kind: "memberInvite",
    clubId: "usmv",
    clubName: "USMV",
    role: "player",
    firstName: "Matia",
    code: "ABC123",
    joinUrl: "https://www.viroteam.com/join?code=ABC123",
  });
  assert.match(mail.textContent, /rejoindre USMV/);
  assert.equal(mail.textContent.includes("au USMV"), false);
  assert.equal(mail.htmlContent.includes("au <strong>USMV</strong>"), false);

  const guardian = buildGuyEmail({
    kind: "guardianInvite",
    clubId: "usmv",
    clubName: "USMV",
    childFirstName: "Tom",
    code: "PAR001",
    joinUrl: "https://www.viroteam.com/join?code=PAR001",
  });
  assert.match(guardian.subject, /Pour suivre Tom — USMV/);
  assert.equal(guardian.subject.includes("au USMV"), false);
});

test("guardianInvite mentionne l’enfant et le club", () => {
  const mail = buildGuyEmail({
    kind: "guardianInvite",
    clubId: "club1",
    clubName: "AS Volley",
    childFirstName: "Tom",
    code: "PARENT1",
    joinUrl: "https://www.viroteam.com/join?code=PARENT1",
  });
  assert.match(mail.subject, /Tom/);
  assert.match(mail.subject, /AS Volley/);
  assert.match(mail.htmlContent, /Tom/);
  assert.match(mail.htmlContent, /PARENT1/);
  assert.ok(mail.tags.includes("guardian-invite"));
});

test("inviteAcceptedMember / guardian : confirmation invitateur", () => {
  const member = buildGuyEmail({
    kind: "inviteAcceptedMember",
    clubId: "club1",
    clubName: "AS Volley",
    memberDisplayName: "Léa Martin",
    role: "player",
  });
  assert.match(member.subject, /Léa Martin a rejoint/);
  assert.match(member.htmlContent, /dans la boîte/);

  const guardian = buildGuyEmail({
    kind: "inviteAcceptedGuardian",
    clubId: "club1",
    clubName: "AS Volley",
    parentDisplayName: "Paul",
    childFirstName: "Tom",
  });
  assert.match(guardian.subject, /Paul suit maintenant Tom/);
  assert.match(guardian.htmlContent, /branché/);
});

test("wrapGuyEmailLayout échappe le nom club et omet logo club si absent", () => {
  const withLogo = wrapGuyEmailLayout({
    preheader: "test",
    clubName: `Club <script>`,
    clubLogoUrl: "https://cdn.example.com/x.png",
    bodyHtml: "<p>ok</p>",
  });
  assert.match(withLogo, /Club &lt;script&gt;/);
  assert.match(withLogo, /cdn\.example\.com\/x\.png/);
  assert.ok(withLogo.includes(APP_LOGO_URL));

  const withoutLogo = wrapGuyEmailLayout({
    preheader: "test",
    clubName: "Club",
    bodyHtml: "<p>ok</p>",
  });
  assert.equal(withoutLogo.includes("cdn.example.com"), false);
  assert.ok(withoutLogo.includes(APP_LOGO_URL));
});

test("escapeHtml protège les injections", () => {
  assert.equal(escapeHtml(`a&b<"c"`), "a&amp;b&lt;&quot;c&quot;");
});
