import type { Metadata } from "next";
import { FamilyFeesClient } from "@/components/family/FamilyFeesClient";

export const metadata: Metadata = {
  title: "Cotisation famille — ViroTeam",
  description: "Cotisation payeur pour tes enfants.",
};

/** Cotisation espace famille. */
export default function FamilyFeesPage() {
  return <FamilyFeesClient />;
}
