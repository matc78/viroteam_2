import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "./SiteHeader.module.css";

const navItems = [
  { href: "#planning", label: "Planning" },
  { href: "#membres", label: "Membres" },
  { href: "#cotisations", label: "Cotisations" },
  { href: "#roles", label: "Rôles" },
  { href: "#demarrer", label: "Démarrer" },
  { href: "#faq", label: "FAQ" },
] as const;

/** En-tête sticky : marque, ancres des sections landing, Espace club. */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label={`${site.name} — accueil`}>
          <BrandMark className={styles.mark} priority />
          <span className={styles.wordmark}>{site.name}</span>
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </a>
          ))}
          <Link href="/login" className={styles.cta}>
            Espace club
          </Link>
        </nav>
      </div>
    </header>
  );
}
