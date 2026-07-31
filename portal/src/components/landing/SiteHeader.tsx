import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";
import styles from "./SiteHeader.module.css";

/** En-tête sticky : marque, ancre fonctionnalités, Espace club. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${site.name} — accueil`}>
          <Image
            src="/logo-mark.svg"
            alt=""
            width={32}
            height={32}
            className={styles.mark}
            priority
          />
          <span className={styles.wordmark}>{site.name}</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          <a href="#fonctionnalites" className={styles.navLink}>
            Fonctionnalités
          </a>
          <Link href="/login" className={styles.cta}>
            Espace club
          </Link>
        </nav>
      </div>
    </header>
  );
}
