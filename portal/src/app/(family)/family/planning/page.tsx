import type { Metadata } from "next";
import { FamilyPlanningClient } from "@/components/family/FamilyPlanningClient";

export const metadata: Metadata = {
  title: "Planning famille — ViroTeam",
  description: "Convocations et RSVP de tes enfants.",
};

/** Planning espace famille. */
export default function FamilyPlanningPage() {
  return <FamilyPlanningClient />;
}
