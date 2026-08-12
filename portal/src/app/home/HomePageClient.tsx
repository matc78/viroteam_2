"use client";

import { AttentionList } from "@/components/dashboard/AttentionList";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { DashboardGuard } from "@/components/auth/DashboardGuard";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { loadHomeDashboard } from "@/lib/firebase/homeService";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import styles from "./page.module.css";

/** Contenu home dashboard branché sur Firestore. */
function HomeDashboardContent() {
  const { activeClub, profile } = useAuth();
  const { data, loading, error } = useAsyncClubResource(
    activeClub,
    (club) =>
      loadHomeDashboard({
        club,
        adminDisplayName: profile?.displayName || "Admin",
      }),
    [profile?.displayName],
  );

  return (
    <DashboardShell>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading={data ? `Bonjour ${data.adminDisplayName}` : "Tableau de bord"}
        lead={
          data
            ? `Vue d’ensemble de ${data.clubName} — ${data.seasonLabel}.`
            : "Chargement de votre espace club…"
        }
      />

      {loading ? (
        <p className={introStyles.lead}>Chargement du tableau de bord…</p>
      ) : null}

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      {data && !loading ? (
        <>
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
        </>
      ) : null}
    </DashboardShell>
  );
}

/** Client home + garde admin. */
export function HomePageClient() {
  return (
    <DashboardGuard>
      <HomeDashboardContent />
    </DashboardGuard>
  );
}
