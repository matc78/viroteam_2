import type { Metadata } from "next";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { mockHomeData } from "@/lib/dashboard/mockHome";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Espace club — ViroTeam",
  description: "Tableau de bord administrateur ViroTeam.",
};

/** Home dashboard admin — données mock, sans auth Firebase. */
export default function HomePage() {
  const data = mockHomeData;

  return (
    <DashboardShell
      clubName={data.clubName}
      adminDisplayName={data.adminDisplayName}
    >
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Espace club</p>
          <h1 className={styles.heading}>
            Bonjour {data.adminDisplayName}
          </h1>
          <p className={styles.lead}>
            Vue d’ensemble de {data.clubName} — {data.seasonLabel}.
          </p>
        </div>
      </header>

      <section className={styles.kpiGrid} aria-label="Indicateurs clés">
        {data.kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </section>

      <section className={styles.chartsGrid} aria-label="Graphiques">
        <FeeStatusChart segments={data.feeStatus} />
        <CollectionsChart months={data.collections} />
      </section>

      <section className={styles.listsGrid} aria-label="Activité">
        <UpcomingEvents events={data.upcomingEvents} />
        <AttentionList items={data.attentionItems} />
      </section>
    </DashboardShell>
  );
}
