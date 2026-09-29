import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Politique de confidentialité — ViroTeam",
  description: "Politique de confidentialité et protection des données ViroTeam.",
  alternates: { canonical: "/legal/privacy" },
};

/** Page confidentialité — lue depuis l’app (review Apple) et le portail. */
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
        <p className={styles.meta}>
          Dernière mise à jour : 28 septembre 2026
        </p>

        <section>
          <h2>1. Responsable du traitement</h2>
          <p>
            Les données personnelles collectées via {site.name} sont traitées
            par l’éditeur du Service, une <strong>personne physique</strong>{" "}
            éditant un projet personnel (voir{" "}
            <Link href="/legal/mentions">mentions légales</Link>), pour fournir
            la gestion de club (compte, planning, cotisations, invitations,
            espace famille).
          </p>
        </section>

        <section>
          <h2>2. Données collectées</h2>
          <p>
            Selon votre usage : identité (nom, prénom, e-mail, identifiant de
            connexion Google ou Apple), données de club (rôle, équipes,
            licence), planning et RSVP, cotisations et aides déclarées, liens
            parent–enfant (espace famille), jeton d’appareil pour les
            notifications push, données de paiement en ligne (montant, statut,
            reçu — jamais les numéros de carte, saisis directement chez Stripe)
            et données techniques de connexion (logs, analytics, crash
            reports).
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
            <li>
              Paiement en ligne des cotisations, lorsque le club l’active
              (optionnel)
            </li>
            <li>Notifications push (convocations, rappels, messages du club)</li>
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
            <li>
              Google Firebase / Google Cloud (Google Ireland Limited) : Auth,
              Firestore, Storage, Functions, Hosting et Cloud Messaging pour les
              notifications push (jeton d’appareil).
            </li>
            <li>
              Google Sign-In (Google Ireland Limited) : connexion avec un compte
              Google — identifiant, nom, e-mail.
            </li>
            <li>
              Sign in with Apple (Apple Distribution International Ltd, Irlande)
              : connexion avec un identifiant Apple — identifiant, nom et e-mail,
              éventuellement masqué par le relais Apple.
            </li>
            <li>
              Stripe Payments Europe Ltd (Irlande) : paiement en ligne des
              cotisations lorsque le club l’active. Données : nom, e-mail,
              montant, club ; les données de carte sont saisies et traitées
              directement par Stripe et ne transitent jamais par nos serveurs.
              Voir la{" "}
              <a
                href="https://stripe.com/fr/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                politique de confidentialité de Stripe
              </a>
              .
            </li>
            <li>PostHog (analytics produit, hébergé en UE)</li>
            <li>Sentry (monitoring d’erreurs de l’app et du portail)</li>
            <li>Brevo (e-mails transactionnels d’invitation)</li>
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
