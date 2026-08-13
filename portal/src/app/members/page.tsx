import type { Metadata } from "next";
import { MembersPageClient } from "./MembersPageClient";

export const metadata: Metadata = {
  title: "Membres — ViroTeam",
  description: "Gérer les membres du club, licences et invitations.",
};

/** Page Membres admin — liste, fiche, import CSV. */
export default function MembersPage() {
  return <MembersPageClient />;
}
