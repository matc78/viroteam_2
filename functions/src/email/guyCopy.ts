import { escapeHtml } from "../brevo";
import { emailCopy } from "./emailCopy";
import {
  emailInviteCodeBlock,
  emailStoreCtaButtons,
  wrapGuyEmailLayout,
} from "./layout";
import type {
  BuiltEmail,
  GuyEmailParams,
  MemberInviteRole,
} from "./types";

/**
 * Normalise un rôle membre pour les variantes de copy.
 */
export function normalizeMemberInviteRole(raw: string): MemberInviteRole {
  const role = raw.trim().toLowerCase();
  if (role === "coach") return "coach";
  if (role === "admin") return "admin";
  return "player";
}

function greeting(firstName: string): { text: string; html: string } {
  const trimmed = firstName.trim();
  if (!trimmed) {
    return {
      text: emailCopy.common.greetingAnonymous,
      html: emailCopy.common.greetingAnonymous,
    };
  }
  const text = emailCopy.common.greetingNamed(trimmed);
  return { text, html: emailCopy.common.greetingNamed(escapeHtml(trimmed)) };
}

function roleLabelFr(role: MemberInviteRole): string {
  if (role === "coach") return emailCopy.common.roleCoach;
  if (role === "admin") return emailCopy.common.roleAdmin;
  return emailCopy.common.rolePlayer;
}

/**
 * Lignes stores (texte) + boutons HTML pour App Store / Google Play.
 */
function storeBlocks(params: {
  appStoreUrl?: string;
  playStoreUrl?: string;
}): { text: string; html: string } {
  const c = emailCopy.common;
  const ios = params.appStoreUrl?.trim();
  const android = params.playStoreUrl?.trim();
  const textLines: string[] = [];
  if (ios) textLines.push(`${c.appStoreLabel} ${ios}`);
  if (android) textLines.push(`${c.playStoreLabel} ${android}`);
  return {
    text: textLines.length ? `\n${textLines.join("\n")}` : "",
    html: emailStoreCtaButtons(ios, android),
  };
}

/**
 * Liens secondaires site + espace club (bas du message).
 */
function webLinksBlock(joinUrl: string): { text: string; html: string } {
  const c = emailCopy.common;
  const text = `
${c.webLinksIntro}
${c.siteLabel} ${c.siteUrl}
${c.clubSpaceLabel} ${joinUrl}`;
  const html = `<p style="margin:20px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">${escapeHtml(c.webLinksIntro)}</p>
<p style="margin:6px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">
  ${escapeHtml(c.siteLabel)} <a href="${escapeHtml(c.siteUrl)}" style="color:#1769b0;">${escapeHtml(c.siteHost)}</a><br />
  ${escapeHtml(c.clubSpaceLabel)} <a href="${escapeHtml(joinUrl)}" style="color:#1769b0;">${escapeHtml(joinUrl)}</a>
</p>`;
  return { text, html };
}

function strongClubLead(parts: { before: string; after: string }, clubName: string): string {
  return `${escapeHtml(parts.before)}<strong>${escapeHtml(clubName)}</strong>${escapeHtml(parts.after)}`;
}

function buildMemberInvite(
  params: Extract<GuyEmailParams, { kind: "memberInvite" }>,
): BuiltEmail {
  const hello = greeting(params.firstName);
  const variant = emailCopy.memberInvite[params.role];
  const subject = variant.subject(params.clubName);
  const textLead = variant.lead(params.clubName);
  const htmlLead = strongClubLead(variant.leadAroundClub, params.clubName);
  const store = storeBlocks({
    appStoreUrl: params.appStoreUrl,
    playStoreUrl: params.playStoreUrl,
  });
  const web = webLinksBlock(params.joinUrl);
  const fallback = emailCopy.common.fallbackAppCode;
  const c = emailCopy.common;

  const textContent = `${hello.text}

${textLead}

${c.codeLabel} : ${params.code}
${c.codeValidDays}${store.text}

${fallback}
${web.text}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${hello.html}</p>
<p style="margin:0 0 18px;">${htmlLead}</p>
${emailInviteCodeBlock(params.code)}
${store.html}
<p style="margin:12px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">${escapeHtml(fallback)}</p>
${web.html}
`;

  return {
    subject,
    textContent,
    htmlContent: wrapGuyEmailLayout({
      preheader: textLead,
      clubName: params.clubName,
      clubLogoUrl: params.clubLogoUrl,
      bodyHtml,
    }),
    tags: ["member-invite", params.role, params.clubId],
  };
}

function buildGuardianInvite(
  params: Extract<GuyEmailParams, { kind: "guardianInvite" }>,
): BuiltEmail {
  const g = emailCopy.guardianInvite;
  const c = emailCopy.common;
  const child = params.childFirstName.trim() || c.defaultChildName;
  const subject = g.subject(child, params.clubName);
  const leadText = g.lead(child, params.clubName);
  const store = storeBlocks({
    appStoreUrl: params.appStoreUrl,
    playStoreUrl: params.playStoreUrl,
  });
  const web = webLinksBlock(params.joinUrl);
  const fallback = c.fallbackAppCode;

  const textContent = `${c.greetingAnonymous}

${leadText}

${c.codeLabel} : ${params.code}
${c.codeValidDays}${store.text}

${fallback}
${web.text}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${escapeHtml(c.greetingAnonymous)}</p>
<p style="margin:0 0 18px;">
  ${escapeHtml(g.leadBeforeChild)}<strong>${escapeHtml(child)}</strong>${escapeHtml(g.leadBetweenChildAndClub)}<strong>${escapeHtml(params.clubName)}</strong>${escapeHtml(g.leadAfterClub)}
</p>
${emailInviteCodeBlock(params.code)}
${store.html}
<p style="margin:12px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">${escapeHtml(fallback)}</p>
${web.html}
`;

  return {
    subject,
    textContent,
    htmlContent: wrapGuyEmailLayout({
      preheader: leadText,
      clubName: params.clubName,
      clubLogoUrl: params.clubLogoUrl,
      bodyHtml,
    }),
    tags: ["guardian-invite", params.clubId],
  };
}

function buildInviteAcceptedMember(
  params: Extract<GuyEmailParams, { kind: "inviteAcceptedMember" }>,
): BuiltEmail {
  const a = emailCopy.inviteAcceptedMember;
  const c = emailCopy.common;
  const name = params.memberDisplayName.trim() || c.defaultSomeone;
  const label = roleLabelFr(params.role);
  const subject = a.subject(name, params.clubName);
  const lead = a.lead(name, label, params.clubName);

  const textContent = `${c.greetingAnonymous}

${lead}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${escapeHtml(c.greetingAnonymous)}</p>
<p style="margin:0 0 8px;">
  <strong>${escapeHtml(name)}</strong>${escapeHtml(a.leadAfterName)}${escapeHtml(label)}${escapeHtml(a.leadBetweenRoleAndClub)}<strong>${escapeHtml(params.clubName)}</strong>${escapeHtml(a.leadClosing)}
</p>
<p style="margin:0;">${escapeHtml(a.closingLine)}</p>
`;

  return {
    subject,
    textContent,
    htmlContent: wrapGuyEmailLayout({
      preheader: lead,
      clubName: params.clubName,
      clubLogoUrl: params.clubLogoUrl,
      bodyHtml,
    }),
    tags: ["invite-accepted", "member", params.clubId],
  };
}

function buildInviteAcceptedGuardian(
  params: Extract<GuyEmailParams, { kind: "inviteAcceptedGuardian" }>,
): BuiltEmail {
  const a = emailCopy.inviteAcceptedGuardian;
  const c = emailCopy.common;
  const parent = params.parentDisplayName.trim() || c.defaultParent;
  const child = params.childFirstName.trim() || c.defaultChildFallback;
  const subject = a.subject(parent, child, params.clubName);
  const lead = a.lead(parent, child, params.clubName);

  const textContent = `${c.greetingAnonymous}

${lead}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${escapeHtml(c.greetingAnonymous)}</p>
<p style="margin:0;">
  <strong>${escapeHtml(parent)}</strong>${escapeHtml(a.leadBetweenParentAndChild)}<strong>${escapeHtml(child)}</strong>${escapeHtml(a.leadBetweenChildAndClub)}<strong>${escapeHtml(params.clubName)}</strong>${escapeHtml(a.leadAfterClub)}
</p>
`;

  return {
    subject,
    textContent,
    htmlContent: wrapGuyEmailLayout({
      preheader: lead,
      clubName: params.clubName,
      clubLogoUrl: params.clubLogoUrl,
      bodyHtml,
    }),
    tags: ["invite-accepted", "guardian", params.clubId],
  };
}

/**
 * Construit sujet + texte + HTML pour un mail Guy (libellés via `emailCopy`).
 */
export function buildGuyEmail(params: GuyEmailParams): BuiltEmail {
  switch (params.kind) {
    case "memberInvite":
      return buildMemberInvite(params);
    case "guardianInvite":
      return buildGuardianInvite(params);
    case "inviteAcceptedMember":
      return buildInviteAcceptedMember(params);
    case "inviteAcceptedGuardian":
      return buildInviteAcceptedGuardian(params);
    default: {
      const _exhaustive: never = params;
      return _exhaustive;
    }
  }
}
