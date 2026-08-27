import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Mentions légales — ViroTeam",
  description: "Mentions légales du service ViroTeam.",
};

/** Mentions légales — projet personnel non commercial. */
export default function MentionsLegalesPage() {
  const contactDomain = site.url.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <BrandMark size={28} />
          <span>{site.name}</span>
        </Link>
        <Link href="/" className={styles.back}>
          Retour
        </Link>
      </header>

      <article className={styles.article}>
        <h1>Mentions légales</h1>
        <p className={styles.meta}>Dernière mise à jour : août 2026</p>

        <section>
          <h2>1. Éditeur du Service</h2>
          <p>
            {site.name} (application mobile et portail web) est un{" "}
            <strong>projet personnel</strong>, édité à titre non professionnel
            et <strong>sans activité commerciale</strong> (pas de vente de
            produits ou d’abonnements via le Service).
          </p>
          <p>
            L’éditeur est une <strong>personne physique</strong> (pas de
            société, pas de SIRET, pas de siège social déclaré).
          </p>
          <p>
            Contact :{" "}
            <a href={`mailto:contact@${contactDomain}`}>
              contact@{contactDomain}
            </a>
          </p>
        </section>

        <section>
          <h2>2. Hébergement</h2>
          <p>
            Le portail web et les services backend sont hébergés via Google
            Cloud / Firebase (Google Ireland Limited / Google LLC), projet{" "}
            <code>viroteam-75303</code>. L’application mobile est distribuée
            via Google Play et, le cas échéant, l’App Store Apple.
          </p>
        </section>

        <section>
          <h2>3. Propriété intellectuelle</h2>
          <p>
            Les éléments du Service (marque, logos, interface, textes) sont
            protégés. Toute reproduction non autorisée est interdite.
          </p>
        </section>

        <section>
          <h2>4. Données personnelles</h2>
          <p>
            Le traitement des données personnelles est décrit dans la{" "}
            <Link href="/legal/privacy">politique de confidentialité</Link>.
            Conditions d’utilisation :{" "}
            <Link href="/legal/cgu">CGU</Link>.
          </p>
        </section>
      </article>
    </main>
  );
}
