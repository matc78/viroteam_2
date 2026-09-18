import { escapeHtml } from "../brevo";
import { emailCopy } from "./emailCopy";

/** Wordmark public du site (footer des mails). */
export const APP_LOGO_URL = "https://www.viroteam.com/logo-wordmark.png";

const COLOR_SCAFFOLD = "#e9eff7";
const COLOR_SURFACE = "#ffffff";
const COLOR_PRIMARY = "#1769b0";
const COLOR_TEXT = "#111827";
const COLOR_MUTED = "#4a5568";
const COLOR_FOOTER = "#8b95a5";

/**
 * Bouton CTA table-safe pour clients mail.
 */
export function emailCtaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">
  <tr>
    <td style="border-radius:8px;background:${COLOR_PRIMARY};">
      <a href="${safeHref}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${safeLabel}
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Bloc code d’invitation mis en avant.
 */
export function emailInviteCodeBlock(code: string): string {
  const safeCode = escapeHtml(code);
  const { codeLabel, codeValidDays } = emailCopy.common;
  return `<p style="margin:0 0 6px;font-size:13px;color:${COLOR_MUTED};">${escapeHtml(codeLabel)}</p>
<p style="margin:0 0 8px;font-size:28px;letter-spacing:0.14em;font-weight:700;color:${COLOR_TEXT};font-family:Consolas,Monaco,monospace;">${safeCode}</p>
<p style="margin:0 0 4px;font-size:13px;color:${COLOR_MUTED};">${escapeHtml(codeValidDays)}</p>`;
}

/**
 * Enveloppe HTML ViroTeam : logo club en body, logo app en footer.
 */
export function wrapGuyEmailLayout(params: {
  preheader: string;
  clubName: string;
  clubLogoUrl?: string;
  bodyHtml: string;
}): string {
  const safePreheader = escapeHtml(params.preheader);
  const safeClub = escapeHtml(params.clubName);
  const c = emailCopy.common;
  const clubLogo = params.clubLogoUrl?.trim();
  const clubLogoBlock = clubLogo
    ? `<tr><td align="center" style="padding:0 0 20px;">
        <img src="${escapeHtml(clubLogo)}" alt="${safeClub}" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:contain;border:0;border-radius:12px;" />
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(c.brandName)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR_SCAFFOLD};font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR_TEXT};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLOR_SCAFFOLD};padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${COLOR_SURFACE};border-radius:14px;padding:28px 24px;">
          ${clubLogoBlock}
          <tr><td style="font-size:16px;line-height:1.55;color:${COLOR_TEXT};">
            ${params.bodyHtml}
          </td></tr>
        </table>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin-top:20px;">
          <tr>
            <td align="center" style="padding:0 8px;">
              <img src="${APP_LOGO_URL}" alt="${escapeHtml(c.brandName)}" width="132" style="display:block;width:132px;height:auto;border:0;margin:0 auto 10px;" />
              <p style="margin:0 0 6px;font-size:13px;color:${COLOR_MUTED};">${escapeHtml(c.footerSignature)}</p>
              <p style="margin:0;font-size:12px;color:${COLOR_FOOTER};">
                <a href="${escapeHtml(c.siteUrl)}" style="color:${COLOR_FOOTER};text-decoration:underline;">${escapeHtml(c.siteHost)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
