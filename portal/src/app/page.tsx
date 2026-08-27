import type { Metadata } from "next";
import { Faq } from "@/components/landing/Faq";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Roles } from "@/components/landing/Roles";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Landing marketing publique ViroTeam. */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <SiteHeader />
      <main>
        <Hero />
        <FeatureShowcase
          id="planning"
          eyebrow="Planning"
          titleId="showcase-planning-title"
          title="Un planning clair pour tout le club"
          lead="Le bureau organise séances et matchs, filtre par équipe ou coach. Membres et parents suivent le calendrier simplement dans l’app — sans chercher l’info ailleurs."
          bullets={[
            "Bureau : créez entraînements et matchs, filtrez par équipe ou coach.",
            "Membres et parents : la semaine à jour, au même endroit.",
            "Multiclub : basculez d’un club à l’autre avec le même compte.",
          ]}
          screenshots={[
            {
              src: "/landing/portal-planning-week.png",
              alt: "Planning semaine ViroTeam avec filtres équipes et coach",
              caption: "Vue semaine — espace club",
            },
          ]}
        />
        <FeatureShowcase
          id="membres"
          reverse
          eyebrow="Membres & équipes"
          titleId="showcase-members-title"
          title="Membres, licences et équipes au même endroit"
          lead="Gérez les effectifs, les invitations et les licences. Composez vos équipes par catégorie avec joueurs et coachs — sans tableur ni groupe messagerie."
          bullets={[
            "Bureau : liste filtrable (rôle, équipe, inscription, cotisation).",
            "Invitations : envoi et copie du lien depuis le tableau.",
            "Équipes : catégories, coachs et joueurs en un coup d’œil.",
          ]}
          screenshots={[
            {
              src: "/landing/portal-members-roster.png",
              alt: "Tableau des membres ViroTeam avec rôles, équipes et invitations",
              caption: "Membres — licences et invitations",
            },
            {
              src: "/landing/portal-members-teams.png",
              alt: "Gestion des équipes ViroTeam par catégorie avec coachs et joueurs",
              caption: "Équipes — composition par catégorie",
            },
          ]}
        />
        <FeatureShowcase
          id="cotisations"
          eyebrow="Cotisations"
          titleId="showcase-fees-title"
          title="Cotisations suivies, restes dus clairs"
          lead="Configurez la saison et les tarifs, suivez qui a payé et ce qui reste dû. Membres et parents voient le statut sans demander."
          bullets={[
            "Bureau : saison, tarifs, puis suivi (à payer, partiel, reste dû).",
            "Parents et membres : montant et échéance visibles, simplement.",
            "Paiement hors-ligne suivi ; paiement en ligne bientôt disponible.",
          ]}
          screenshots={[
            {
              src: "/landing/portal-fees-config.png",
              alt: "Configuration saison et tarifs des cotisations ViroTeam",
              caption: "Configuration — saison et tarifs",
            },
            {
              src: "/landing/portal-fees-tracking.png",
              alt: "Suivi des cotisations avec statuts et restes dus",
              caption: "Suivi — qui doit quoi",
            },
          ]}
        />
        <Roles />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
