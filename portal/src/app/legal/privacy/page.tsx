import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Politique de confidentialité — ViroTeam",
  description: "Politique de confidentialité et protection des données ViroTeam.",
};

/** Page confidentialité (template à valider avec l’identité réelle de l’éditeur). */
export default function PrivacyPage() {
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
        <h1>Politique de confidentialité</h1>
        <p className={styles.meta}>Dernière mise à jour : août 2026</p>

        <section>
          <h2>1. Responsable du traitement</h2>
          <p>
            Les données personnelles collectées via {site.name} sont traitées
            par l’éditeur du Service, un{" "}
            <strong>projet personnel non commercial</strong> (voir{" "}
            <Link href="/legal/mentions">mentions légales</Link>), pour fournir
            la gestion de club (compte, planning, cotisations, invitations,
            espace famille).
          </p>
        </section>

        <section>
          <h2>2. Données collectées</h2>
          <p>
            Selon votre usage : identité (nom, prénom, e-mail), données de
            club (rôle, équipes, licence), planning et RSVP, cotisations et
            aides déclarées, liens parent–enfant (espace famille), et données
            techniques de connexion (logs, analytics, crash reports).
          </p>
        </section>

        <section>
          <h2>3. Données relatives aux mineurs</h2>
          <p>
            Lorsqu’un parent ou tuteur est lié à une fiche joueur, le Service
            permet de consulter le planning, de répondre aux RSVP et de gérer
            la cotisation au nom de l’enfant. Ces données sont saisies et
            contrôlées par le club et/ou le parent lié. {site.name} ne crée
            pas de compte Auth pour l’enfant en V1.
          </p>
        </section>

        <section>
          <h2>4. Finalités</h2>
          <ul>
            <li>Authentification et gestion du compte</li>
            <li>Fonctionnement du club (membres, planning, cotisations)</li>
            <li>Invitations et rattachements parents</li>
            <li>Sécurité, support et amélioration du Service</li>
            <li>Mesure d’audience (sous réserve de consentement cookies)</li>
          </ul>
        </section>

        <section>
          <h2>5. Base légale</h2>
          <p>
            Exécution du contrat (fourniture du Service), intérêt légitime
            (sécurité, amélioration) et, le cas échéant, consentement
            (analytics / cookies non essentiels).
          </p>
        </section>

        <section>
          <h2>6. Sous-traitants</h2>
          <p>
            Le Service s’appuie notamment sur :
          </p>
          <ul>
            <li>Google Firebase / Google Cloud (Auth, Firestore, Storage, Functions, Hosting)</li>
            <li>PostHog (analytics produit, UE)</li>
            <li>Sentry (monitoring d’erreurs du portail)</li>
            <li>Brevo (e-mails transactionnels d’invitation)</li>
            <li>HelloAsso (paiements en ligne, lorsque activés pour un club)</li>
          </ul>
        </section>

        <section>
          <h2>7. Conservation</h2>
          <p>
            Les données de compte sont conservées pendant la durée
            d’utilisation du Service. Après suppression du compte Auth, le
            profil est désactivé ; les données club (roster, historique)
            restent sous la responsabilité des administrateurs du club, puis
            sont purgées ou anonymisées selon les obligations légales
            applicables.
          </p>
        </section>

        <section>
          <h2>8. Vos droits</h2>
          <p>
            Vous pouvez exercer vos droits d’accès, de rectification,
            d’effacement, de limitation et d’opposition en nous contactant.
            La suppression de compte est disponible dans l’app (Profil) et
            sur le portail (Paramètres → Compte). Vous pouvez également
            introduire une réclamation auprès de la CNIL.
          </p>
        </section>

        <section>
          <h2>9. Contact</h2>
          <p>
            Pour toute demande relative à vos données :{" "}
            <a href={`mailto:privacy@${contactDomain}`}>
              privacy@{contactDomain}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
