"use client";

import Link from "next/link";
import { AttentionList } from "@/components/dashboard/AttentionList";
import { CollectionsChart } from "@/components/dashboard/CollectionsChart";
import { DashboardPageIntro } from "@/components/dashboard/DashboardPageIntro";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { FeeStatusChart } from "@/components/dashboard/FeeStatusChart";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { loadHomeDashboard } from "@/lib/firebase/homeService";
import { useAsyncClubResource } from "@/lib/dashboard/useAsyncClubResource";
import introStyles from "@/components/dashboard/DashboardPageIntro.module.css";
import transitionStyles from "@/components/dashboard/DashboardPageTransition.module.css";
import styles from "./page.module.css";

/** Contenu home dashboard branché sur Firestore. */
export function HomePageClient() {
  const { activeClub, profile } = useAuth();
  const { data, loading, refreshing, error, reload } = useAsyncClubResource(
    activeClub,
    (club) =>
      loadHomeDashboard({
        club,
        adminDisplayName: profile?.displayName || "Admin",
      }),
    [profile?.displayName],
  );

  if (loading && !data) {
    return <DashboardSkeleton variant="home" />;
  }

  return (
    <div className={refreshing ? transitionStyles.refreshing : undefined}>
      <DashboardPageIntro
        eyebrow="Espace club"
        heading={data ? `Bonjour ${data.adminDisplayName}` : "Tableau de bord"}
        lead={
          data
            ? `Vue d’ensemble de ${data.clubName} — ${data.seasonLabel}.`
            : "Chargement de votre espace club…"
        }
        onRefresh={reload}
        refreshing={refreshing}
      />

      {error ? (
        <p className={introStyles.lead} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.homeActions}>
        <Link href="/announcements" className={styles.announcementsCta}>
          Annonces
        </Link>
      </div>

      {data ? (
        <>
          <section className={styles.kpiGrid} aria-label="Indicateurs clés">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </section>

          <section className={styles.activityGrid} aria-label="Planning et alertes">
            <UpcomingEvents events={data.upcomingEvents} />
            <AttentionList items={data.attentionItems} />
          </section>

          <section className={styles.chartsGrid} aria-label="Cotisations">
            <FeeStatusChart segments={data.feeStatus} />
            <CollectionsChart
              months={data.collections}
              showHelloAsso={activeClub?.onlinePaymentEnabled === true}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
