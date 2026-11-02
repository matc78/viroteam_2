import { Card, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { ListRow, ListRows } from "@/components/ui/ListRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AttentionItem } from "@/lib/firebase/homeService";
import styles from "./home.module.css";

/** Page où traiter une alerte bureau (cotisations, réponses faibles…). */
function attentionHref(item: AttentionItem): string | undefined {
  if (item.id.startsWith("rsvp-")) {
    return `/planning?eventId=${encodeURIComponent(item.id.slice("rsvp-".length))}`;
  }
  if (item.id === "overdue" || item.id === "aids" || item.id === "no-season") {
    return "/fees";
  }
  return undefined;
}

/**
 * Bandeau « À traiter » en tête de l’accueil staff : chaque alerte est une
 * ligne cliquable vers la page concernée. Une ligne verte si rien n’est urgent.
 */
export function AttentionCard({ items }: { items: AttentionItem[] }) {
  const actionable = items.filter((item) => item.severity !== "low");

  if (actionable.length === 0) {
    return (
      <p className={styles.allClear} role="status">
        <Icon name="check" size={18} />
        Rien d’urgent : le club est à jour.
      </p>
    );
  }

  return (
    <Card
      padding="none"
      variant="attention"
      className={styles.section}
      aria-labelledby="home-attention-title"
    >
      <CardHeader
        title="À traiter"
        titleId="home-attention-title"
        action={
          <StatusBadge tone="warning">
            {actionable.length} point{actionable.length > 1 ? "s" : ""}
          </StatusBadge>
        }
      />
      <ListRows aria-label="Points à traiter">
        {actionable.map((item) => {
          const href = attentionHref(item);
          return (
            <ListRow
              key={item.id}
              href={href}
              leading={
                <span
                  className={styles.severityDot}
                  data-severity={item.severity}
                  aria-hidden
                />
              }
              title={item.title}
              meta={item.detail}
              trailing={
                href ? <Icon name="chevronRight" size={18} /> : undefined
              }
            />
          );
        })}
      </ListRows>
    </Card>
  );
}
