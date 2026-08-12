import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DecorShapes } from "@/components/landing/DecorShapes";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
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
      <body className={inter.className}>
        <Providers>
          <DecorShapes />
          <div className="app-root">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
