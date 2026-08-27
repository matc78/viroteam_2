import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Conditions générales d’utilisation — ViroTeam",
  description: "Conditions générales d’utilisation de ViroTeam.",
};

/** Page CGU (contenu minimal sérieux). */
export default function CguPage() {
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
        <h1>Conditions générales d’utilisation</h1>
        <p className={styles.meta}>Dernière mise à jour : août 2026</p>

        <section>
          <h2>1. Objet</h2>
          <p>
            Les présentes conditions générales d’utilisation (CGU) régissent
            l’accès et l’usage de l’application mobile ViroTeam et du portail
            web associé (ci-après « le Service »), édités pour faciliter la
            gestion des clubs sportifs amateurs.
          </p>
        </section>

        <section>
          <h2>2. Acceptation</h2>
          <p>
            L’utilisation du Service implique l’acceptation sans réserve des
            présentes CGU. Si vous n’acceptez pas ces conditions, vous ne devez
            pas utiliser le Service.
          </p>
        </section>

        <section>
          <h2>3. Compte utilisateur</h2>
          <p>
            Vous êtes responsable de la confidentialité de vos identifiants et
            de l’exactitude des informations fournies. Vous vous engagez à
            n’utiliser le Service que dans le cadre légitime d’un club dont vous
            êtes membre, coach, administrateur ou parent lié.
          </p>
        </section>

        <section>
          <h2>4. Données et contenu</h2>
          <p>
            Les données du club (membres, planning, cotisations, etc.) restent
            sous la responsabilité des administrateurs du club. ViroTeam
            fournit les outils techniques ; le club reste responsable du
            contenu saisi et du respect du droit applicable (RGPD, droit à
            l’image, etc.).
          </p>
        </section>

        <section>
          <h2>5. Disponibilité</h2>
          <p>
            Le Service est fourni « en l’état ». Nous nous efforçons d’assurer
            une disponibilité raisonnable, sans garantie d’absence
            d’interruption ou d’erreur.
          </p>
        </section>

        <section>
          <h2>6. Contact</h2>
          <p>
            Pour toute question relative aux présentes CGU :{" "}
            <a href={`mailto:contact@${site.url.replace(/^https?:\/\/(www\.)?/, "")}`}>
              contact@{site.url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
