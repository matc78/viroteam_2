import { site } from "@/lib/site";

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  url: site.url,
  applicationCategory: "SportsApplication",
  operatingSystem: "Android, Web",
  inLanguage: "fr-FR",
  description: site.seoDescription,
  image: `${site.url}${site.logoStacked}`,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  featureList: [
    "Planning partagé des entraînements et matchs",
    "Gestion des membres, licences et équipes",
    "Convocations et RSVP",
    "Suivi des cotisations et relances",
    "Multiclub — plusieurs clubs par compte",
    "Vues bureau, membres et parents",
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}${site.logoMark}`,
  description: site.seoDescription,
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "ViroTeam, c’est quoi ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ViroTeam organise le planning, les relances et le suivi des cotisations. Le bureau pilote ; membres et parents suivent simplement. Un compte peut rejoindre plusieurs clubs.",
      },
    },
    {
      "@type": "Question",
      name: "Comment organiser le planning du club ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le coach ou l’admin crée séances et matchs, filtre par équipe ou coach, et suit les réponses aux convocations. Membres et parents voient le même calendrier dans l’app.",
      },
    },
    {
      "@type": "Question",
      name: "Comment gérer les membres et les équipes ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le bureau suit licences et invitations, filtre l’effectif, et compose les équipes par catégorie avec joueurs et coachs. Parents et membres rejoignent le club sur invitation.",
      },
    },
    {
      "@type": "Question",
      name: "Comment suivre les cotisations et les relances ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Le bureau configure la saison et les tarifs, puis suit qui a payé et les restes dus. Parents et membres voient montant et échéance.",
      },
    },
    {
      "@type": "Question",
      name: "Peut-on gérer plusieurs clubs ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui. Avec un même compte, vous pouvez appartenir à plusieurs clubs (multiclub) et basculer facilement entre eux.",
      },
    },
  ],
};

/** Données structurées JSON-LD pour Google (app, organisation, FAQ). */
export function JsonLd() {
  const blocks = [softwareApplicationJsonLd, organizationJsonLd, faqJsonLd];
  return (
    <>
      {blocks.map((block) => (
        <script
          key={block["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
