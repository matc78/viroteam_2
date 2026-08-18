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
    "Planning des entraînements et matchs",
    "Convocations et RSVP",
    "Cotisations HelloAsso",
    "Gestion des équipes et invitations",
    "Communication club",
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
        text: "ViroTeam est une application de gestion de club sportif : planning, convocations RSVP, cotisations, équipes et communication pour joueurs, coachs, parents et administrateurs.",
      },
    },
    {
      "@type": "Question",
      name: "Comment gérer le planning et les convocations d’un club de football ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Dans ViroTeam, le coach ou l’admin crée les entraînements et matchs, envoie les convocations, et suit les réponses (présent, absent, peut-être) en temps réel.",
      },
    },
    {
      "@type": "Question",
      name: "Peut-on encaisser les cotisations du club ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui. Les cotisations se paient via HelloAsso. Les membres règlent depuis l’app, le bureau suit les paiements sans tableur parallèle.",
      },
    },
    {
      "@type": "Question",
      name: "Qui peut utiliser ViroTeam ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Les joueurs, coachs, parents et admins d’un club. L’accès se fait uniquement sur invitation, pas d’inscription ouverte au public.",
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
