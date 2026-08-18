import type { Metadata } from "next";
import { FamilyHomeClient } from "@/components/family/FamilyHomeClient";

export const metadata: Metadata = {
  title: "Famille — ViroTeam",
  description: "Planning, RSVP et cotisation de tes enfants.",
};

/** Accueil espace famille. */
export default function FamilyHomePage() {
  return <FamilyHomeClient />;
}
