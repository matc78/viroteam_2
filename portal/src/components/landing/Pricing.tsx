import Link from "next/link";
import {
  PLATFORM_FLAT_LABEL,
  STRIPE_FIXED_CENTS,
  STRIPE_PERCENT,
  cardGrossCentsFromNet,
} from "@/lib/stripe/cardGrossFromNet";
import section from "./LandingSection.module.css";
import styles from "./Pricing.module.css";

/** Cotisation d'exemple pour illustrer les frais CB (centimes). */
const EXAMPLE_NET_CENTS = 15000;

function formatEuros(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

const stripeLabel = `${String(STRIPE_PERCENT * 100).replace(".", ",")} % + ${formatEuros(STRIPE_FIXED_CENTS)}`;

const included = [
  "Planning, récurrences et convocations",
  "Rappels et récap automatiques",
  "Membres, équipes, parents et invitations",
  "Annonces du club",
  "Suivi des cotisations hors ligne",
  "App Android et iPhone, espace club web",
] as const;

/** Tarifs : bêta gratuite ; seul le paiement CB des cotisations a un coût, payé par le membre. */
export function Pricing() {
  const exampleGross = cardGrossCentsFromNet(EXAMPLE_NET_CENTS);

  return (
    <section id="tarifs" className={`${section.section} ${section.tinted}`} aria-labelledby="pricing-title">
      <div className={section.inner}>
        <header className={section.header}>
          <span className={section.eyebrow}>Tarifs</span>
          <h2 id="pricing-title" className={section.title}>
            Gratuit pour le club pendant la bêta
          </h2>
          <p className={section.lead}>
            ViroTeam est en bêta : l’app s’améliore avec les clubs qui
            l’utilisent. Vos retours décident des prochaines fonctions.
          </p>
        </header>

        <div className={styles.grid}>
          <article className={styles.card}>
            <p className={styles.plan}>Le club</p>
            <p className={styles.price}>
              0 €<span className={styles.per}> / mois, sans engagement</span>
            </p>
            <ul className={styles.list}>
              {included.map((item) => (
                <li key={item} className={styles.item}>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/signup?intent=founder" className={styles.cta}>
              Créer mon club gratuitement
            </Link>
          </article>

          <article className={`${styles.card} ${styles.cardAlt}`}>
            <p className={styles.plan}>Paiement des cotisations par carte</p>
            <p className={styles.price}>
              Optionnel<span className={styles.per}>, activé par le club</span>
            </p>
            <p className={styles.text}>
              Le club reçoit exactement le montant qu’il a fixé. Le membre paie
              les frais bancaires Stripe ({stripeLabel}) et{" "}
              {PLATFORM_FLAT_LABEL.replace(" ", " ")} qui finance le développement de
              l’app.
            </p>
            <dl className={styles.example}>
              <div className={styles.exampleRow}>
                <dt>Cotisation fixée par le club</dt>
                <dd>{formatEuros(EXAMPLE_NET_CENTS)}</dd>
              </div>
              <div className={styles.exampleRow}>
                <dt>Payé par le membre en carte</dt>
                <dd>{formatEuros(exampleGross)}</dd>
              </div>
              <div className={`${styles.exampleRow} ${styles.exampleTotal}`}>
                <dt>Reçu par le club</dt>
                <dd>{formatEuros(EXAMPLE_NET_CENTS)}</dd>
              </div>
            </dl>
            <p className={styles.note}>
              Espèces, chèque ou virement : suivi gratuit dans l’espace club.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
