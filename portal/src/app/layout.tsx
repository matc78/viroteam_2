import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ViroTeam — Tout le club, une seule app",
  description:
    "Pilotez planning, RSVP, cotisations et équipes. Joueurs, coachs, parents et admins réunis dans ViroTeam.",
  openGraph: {
    title: "ViroTeam",
    description:
      "Pilotez planning, RSVP, cotisations et équipes — une app pour tout le club.",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${sora.variable} ${sourceSans.variable}`}>{children}</body>
    </html>
  );
}
