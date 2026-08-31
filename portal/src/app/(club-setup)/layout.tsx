import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Créer mon club — ViroTeam",
  description: "Configurez votre club en quelques étapes sur le portail ViroTeam.",
  robots: { index: false, follow: false },
};

type ClubSetupLayoutProps = {
  children: ReactNode;
};

/** Layout plein écran du wizard (hors AuthShell étroit). */
export default function ClubSetupLayout({ children }: ClubSetupLayoutProps) {
  return children;
}
