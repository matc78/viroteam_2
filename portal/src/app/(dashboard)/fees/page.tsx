import type { Metadata } from "next";
import { FeesPageClient } from "./FeesPageClient";

export const metadata: Metadata = {
  title: "Cotisations — ViroTeam",
  description: "Configuration des cotisations et du paiement HelloAsso.",
};

/** Page Cotisations admin — lecture/écriture Firestore. */
export default function FeesPage() {
  return <FeesPageClient />;
}
