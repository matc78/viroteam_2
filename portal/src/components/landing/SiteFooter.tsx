import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "./SiteFooter.module.css";

/** Pied de page léger. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <BrandMark size={28} className={styles.mark} />
          <div>
            <p className={styles.brand}>{site.name}</p>
            <p className={styles.copy}>© {year} {site.name}. Tous droits réservés.</p>
          </div>
        </div>
        <nav className={styles.links} aria-label="Pied de page">
          <a href="#fonctionnalites" className={styles.link}>
            Fonctionnalités
          </a>
          <Link href="/login" className={styles.link}>
            Espace club
          </Link>
        </nav>
      </div>
    </footer>
  );
}
