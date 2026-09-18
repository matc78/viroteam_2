import { faqJsonLdEntities } from "@/lib/seo";
import { site } from "@/lib/site";

const keywordsCsv = site.seoKeywords.join(", ");

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: site.name,
  alternateName: ["Viro Team", "Viroteam"],
  url: site.url,
  applicationCategory: "SportsApplication",
  applicationSubCategory: "Club management",
  operatingSystem: "Android, Web",
  inLanguage: "fr-FR",
  description: site.seoDescription,
  keywords: keywordsCsv,
  image: `${site.url}${site.logoStacked}`,
  downloadUrl: site.playStoreUrl,
  installUrl: site.playStoreUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
  },
  featureList: [
    "Application de gestion de club sportif amateur",
    "Planning partagé des entraînements et matchs",
    "Convocations et RSVP",
    "Gestion des membres, licences et équipes",
    "Suivi des cotisations et restes dus",
    "Espace bureau web (portail club)",
    "App mobile pour joueurs, coachs et parents",
    "Multiclub — plusieurs clubs par compte",
  ],
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  alternateName: ["Viro Team", "Viroteam"],
  url: site.url,
  logo: `${site.url}${site.logoMark}`,
  description: site.seoDescription,
  knowsAbout: [...site.seoKeywords],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: site.name,
  alternateName: ["Viro Team", "Viroteam"],
  url: site.url,
  description: site.seoDescription,
  inLanguage: "fr-FR",
  keywords: keywordsCsv,
  publisher: {
    "@type": "Organization",
    name: site.name,
    url: site.url,
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqJsonLdEntities(),
};

/** Données structurées JSON-LD pour Google (site, app, organisation, FAQ). */
export function JsonLd() {
  const blocks = [
    websiteJsonLd,
    softwareApplicationJsonLd,
    organizationJsonLd,
    faqJsonLd,
  ];
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
