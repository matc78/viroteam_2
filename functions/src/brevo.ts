/**
 * Client minimal Brevo (API transactionnelle SMTP).
 * Docs : https://developers.brevo.com/reference/sendtransacemail
 */

const BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email";

export type BrevoSender = {
  name: string;
  email: string;
};

export type BrevoSendResult = {
  messageId: string;
};

/**
 * Envoie un e-mail transactionnel via Brevo.
 * Lève une Error avec le détail API en cas d’échec.
 */
export async function sendBrevoTransactionalEmail(params: {
  apiKey: string;
  sender: BrevoSender;
  toEmail: string;
  toName?: string;
  subject: string;
  textContent: string;
  htmlContent: string;
  /** Tags Brevo pour le suivi (ex. member-invite). */
  tags?: string[];
}): Promise<BrevoSendResult> {
  const payload: Record<string, unknown> = {
    sender: params.sender,
    to: [
      {
        email: params.toEmail,
        ...(params.toName ? { name: params.toName } : {}),
      },
    ],
    subject: params.subject,
    textContent: params.textContent,
    htmlContent: params.htmlContent,
  };
  if (params.tags && params.tags.length > 0) {
    payload.tags = params.tags;
  }

  const response = await fetch(BREVO_SMTP_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": params.apiKey,
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsed: Record<string, unknown> = {};
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  if (!response.ok) {
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : `Brevo HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    messageId: String(parsed.messageId ?? ""),
  };
}

/** Échappe le HTML pour injection dans un template simple. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
