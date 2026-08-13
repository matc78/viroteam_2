import type { Metadata } from "next";
import { PlanningPageClient } from "./PlanningPageClient";

export const metadata: Metadata = {
  title: "Planning — ViroTeam",
  description: "Agenda club — vues mois, semaine et jour.",
};

/** Page Planning admin — lecture Firestore. */
export default function PlanningPage() {
  return <PlanningPageClient />;
}
