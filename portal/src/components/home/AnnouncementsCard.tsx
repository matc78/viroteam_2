import { Card, CardHeader } from "@/components/ui/Card";
import { TextLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatShortDate } from "./homeFormat";
import styles from "./home.module.css";

/** Annonce affichée sur un accueil. */
export type HomeAnnouncementItem = {
  id: string;
  message: string;
  author: string;
  createdAt?: Date | null;
  /** Audience visée (« Tout le club », « U13 »), vue staff. */
  targetLabel?: string;
};

/** Carte annonces : messages récents, auteur et date. */
export function AnnouncementsCard({
  items,
  viewAllHref,
}: {
  items: HomeAnnouncementItem[];
  /** Lien vers la page Annonces (staff seulement). */
  viewAllHref?: string;
}) {
  return (
    <Card padding="none" aria-labelledby="home-announcements-title">
      <CardHeader
        title="Annonces"
        titleId="home-announcements-title"
        action={
          viewAllHref ? <TextLink href={viewAllHref}>Voir tout</TextLink> : null
        }
      />
      {items.length === 0 ? (
        <div className={styles.cardEmpty}>
          <EmptyState>Aucune annonce en cours.</EmptyState>
        </div>
      ) : (
        <ul className={styles.announcements}>
          {items.map((item) => (
            <li key={item.id} className={styles.announcement}>
              <p className={styles.announcementMessage}>{item.message}</p>
              <p className={styles.announcementMeta}>
                {[
                  item.author || "Club",
                  item.targetLabel,
                  formatShortDate(item.createdAt ?? null),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
