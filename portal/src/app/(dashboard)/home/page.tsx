import type { Metadata } from "next";
import { HomePageClient } from "./HomePageClient";

export const metadata: Metadata = {
  title: "Espace club — ViroTeam",
  description: "Tableau de bord administrateur ViroTeam.",
};

/** Home dashboard admin — données Firestore. */
export default function HomePage() {
  return <HomePageClient />;
}
