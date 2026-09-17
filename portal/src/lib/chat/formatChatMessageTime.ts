/** Heure d’envoi d’un message chat (ex. « 14:25 »). */
export function formatChatMessageTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
