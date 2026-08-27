import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Politique de confidentialité — ViroTeam",
  description: "Politique de confidentialité et protection des données ViroTeam.",
};

/** Page confidentialité (contenu minimal sérieux). */
export default function PrivacyPage() {
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
        <h1>Politique de confidentialité</h1>
        <p className={styles.meta}>Dernière mise à jour : août 2026</p>

        <section>
          <h2>1. Responsable du traitement</h2>
          <p>
            Les données personnelles collectées via {site.name} sont traitées
            pour fournir le Service de gestion de club (compte, planning,
            cotisations, invitations).
          </p>
        </section>

        <section>
          <h2>2. Données collectées</h2>
          <p>
            Selon votre usage : identité (nom, prénom, e-mail), données de
            club (rôle, équipes), planning et RSVP, cotisations, et données
            techniques de connexion (logs, analytics).
          </p>
        </section>

        <section>
          <h2>3. Finalités</h2>
          <ul>
            <li>Authentification et gestion du compte</li>
            <li>Fonctionnement du club (membres, planning, cotisations)</li>
            <li>Sécurité, support et amélioration du Service</li>
          </ul>
        </section>

        <section>
          <h2>4. Base légale</h2>
          <p>
            Exécution du contrat (fourniture du Service), intérêt légitime
            (sécurité, amélioration) et, le cas échéant, consentement.
          </p>
        </section>

        <section>
          <h2>5. Conservation</h2>
          <p>
            Les données sont conservées pendant la durée d’utilisation du
            compte et selon les obligations légales applicables, puis
            supprimées ou anonymisées.
          </p>
        </section>

        <section>
          <h2>6. Vos droits</h2>
          <p>
            Vous pouvez exercer vos droits d’accès, de rectification,
            d’effacement, de limitation et d’opposition en nous contactant.
            Vous pouvez également introduire une réclamation auprès de la
            CNIL.
          </p>
        </section>

        <section>
          <h2>7. Contact</h2>
          <p>
            Pour toute demande relative à vos données :{" "}
            <a href={`mailto:privacy@${site.url.replace(/^https?:\/\/(www\.)?/, "")}`}>
              privacy@{site.url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
