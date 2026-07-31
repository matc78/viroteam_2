import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Espace club — ViroTeam",
  description: "Connexion administrateur — bientôt disponible.",
};

/** Stub connexion admin — Firebase arrivera plus tard. */
export default function LoginPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />
      <main className={styles.main}>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>Espace club</span>
          <h1 className={styles.title}>Connexion bientôt disponible</h1>
          <p className={styles.body}>
            L&apos;espace web est réservé aux administrateurs du club. La
            connexion Firebase arrive dans une prochaine version.
          </p>
          <Link href="/" className={styles.back}>
            Retour à l&apos;accueil
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
