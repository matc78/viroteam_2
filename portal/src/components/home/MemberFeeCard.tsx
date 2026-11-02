import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MemberFeeStatuses } from "@/lib/firebase/constants";
import { isDeadlineToday } from "@/lib/firebase/feeService";
import type { FeeSeasonRecord, MemberFeeRecord } from "@/lib/firebase/feeService";
import { feeStatusLabel } from "@/lib/members/membersView";
import { formatEuros } from "./homeFormat";
import styles from "./home.module.css";

/** Props de la carte cotisation d’un membre (soi ou enfant). */
type MemberFeeCardProps = {
  fee: MemberFeeRecord | null;
  season: FeeSeasonRecord | null;
  remainingCents: number;
  feesHref: string;
  /** Prénom de l’enfant suivi ; `null` pour sa propre cotisation. */
  childFirstName?: string | null;
};

/**
 * Cotisation de la saison : reste à payer et bouton de règlement mis en avant,
 * ou statut discret quand tout est réglé.
 */
export function MemberFeeCard({
  fee,
  season,
  remainingCents,
  feesHref,
  childFirstName = null,
}: MemberFeeCardProps) {
  const due =
    fee != null &&
    season != null &&
    (fee.status === MemberFeeStatuses.aPayer ||
      fee.status === MemberFeeStatuses.partiel) &&
    remainingCents > 0;
  const deadlineToday =
    due &&
    season?.paymentDeadlineAt != null &&
    isDeadlineToday(season.paymentDeadlineAt);

  if (!fee || !season) {
    return (
      <Card aria-labelledby="home-fee-title">
        <CardHeader title="Cotisation" titleId="home-fee-title" />
        <p className={styles.mutedText}>
          Pas de cotisation demandée pour l’instant.
        </p>
      </Card>
    );
  }

  if (!due) {
    return (
      <Card aria-labelledby="home-fee-title">
        <CardHeader
          title="Cotisation"
          titleId="home-fee-title"
          action={
            <StatusBadge tone="success" dot>
              {feeStatusLabel(fee.status)}
            </StatusBadge>
          }
        />
        <p className={styles.mutedText}>
          {childFirstName
            ? `La saison de ${childFirstName} est en règle.`
            : "Ta saison est en règle."}
        </p>
      </Card>
    );
  }

  return (
    <Card variant="attention" aria-labelledby="home-fee-title">
      <CardHeader
        title="Cotisation"
        titleId="home-fee-title"
        action={
          <StatusBadge tone={deadlineToday ? "danger" : "warning"} dot>
            {deadlineToday ? "Échéance aujourd’hui" : feeStatusLabel(fee.status)}
          </StatusBadge>
        }
      />
      <div className={styles.feeDue}>
        <span className={styles.feeAmount}>{formatEuros(remainingCents)}</span>
        <span className={styles.mutedText}>
          {childFirstName
            ? `Reste à régler pour ${childFirstName}`
            : "Reste à régler pour la saison"}
        </span>
      </div>
      <ButtonLink href={feesHref} variant="primary">
        Régler la cotisation
      </ButtonLink>
    </Card>
  );
}
