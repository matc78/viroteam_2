import { escapeHtml } from "../brevo";
import { emailCopy } from "./emailCopy";
import {
  emailCtaButton,
  emailInviteCodeBlock,
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

function storeLines(playStoreUrl?: string): { text: string; html: string } {
  const url = playStoreUrl?.trim();
  if (!url) return { text: "", html: "" };
  const { playStoreLabel, playStoreDownload } = emailCopy.common;
  return {
    text: `\n${playStoreLabel} ${url}`,
    html: `<p style="margin:16px 0 0;font-size:14px;color:#4a5568;">${escapeHtml(playStoreLabel)} <a href="${escapeHtml(url)}" style="color:#1769b0;">${escapeHtml(playStoreDownload)}</a></p>`,
  };
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
  const store = storeLines(params.playStoreUrl);
  const fallback = emailCopy.common.fallbackAppCode;
  const c = emailCopy.common;

  const textContent = `${hello.text}

${textLead}

${c.codeLabel} : ${params.code}
${c.codeValidDays}
${c.linkPrefix} ${params.joinUrl}${store.text}

${fallback}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${hello.html}</p>
<p style="margin:0 0 18px;">${htmlLead}</p>
${emailInviteCodeBlock(params.code)}
${emailCtaButton(params.joinUrl, c.ctaOpenInvite)}
<p style="margin:12px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">${escapeHtml(fallback)}</p>
${store.html}
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
  const store = storeLines(params.playStoreUrl);
  const fallback = c.fallbackAppCode;

  const textContent = `${c.greetingAnonymous}

${leadText}

${c.codeLabel} : ${params.code}
${c.codeValidDays}
${c.linkPrefix} ${params.joinUrl}${store.text}

${fallback}

${c.signOff}`;

  const bodyHtml = `
<p style="margin:0 0 14px;">${escapeHtml(c.greetingAnonymous)}</p>
<p style="margin:0 0 18px;">
  ${escapeHtml(g.leadBeforeChild)}<strong>${escapeHtml(child)}</strong>${escapeHtml(g.leadBetweenChildAndClub)}<strong>${escapeHtml(params.clubName)}</strong>${escapeHtml(g.leadAfterClub)}
</p>
${emailInviteCodeBlock(params.code)}
${emailCtaButton(params.joinUrl, c.ctaOpenInvite)}
<p style="margin:12px 0 0;font-size:13px;color:#4a5568;line-height:1.45;">${escapeHtml(fallback)}</p>
${store.html}
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
