import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "./SiteHeader.module.css";

const navItems = [
  { href: "/#automatique", label: "Comment ça marche" },
  { href: "/#semaine", label: "Une semaine" },
  { href: "/#bureau", label: "Espace bureau" },
  { href: "/#roles", label: "Rôles" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** En-tête sticky : marque, ancres des sections landing, Espace club et création de club. */
export function SiteHeader({
  showCreateClub = true,
}: {
  /** Masque « Créer mon club » (ex. pendant la création d'un club). */
  showCreateClub?: boolean;
} = {}) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${site.name} — accueil`}>
          <BrandMark className={styles.mark} priority />
          <span className={styles.wordmark}>{site.name}</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
          <Link href="/login" className={styles.cta}>
            Espace club
          </Link>
          {showCreateClub ? (
            <Link href="/signup?intent=founder" className={styles.ctaPrimary}>
              Créer mon club
            </Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
