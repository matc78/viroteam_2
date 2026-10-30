import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { site } from "@/lib/site";
import styles from "./SiteFooter.module.css";

const footerLinks = [
  { href: "/#automatique", label: "Comment ça marche" },
  { href: "/#semaine", label: "Une semaine" },
  { href: "/#bureau", label: "Espace bureau" },
  { href: "/#roles", label: "Rôles" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
] as const;

const legalLinks = [
  { href: "/legal/cgu", label: "CGU" },
  { href: "/legal/privacy", label: "Confidentialité" },
  { href: "/legal/mentions", label: "Mentions légales" },
] as const;

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
          {footerLinks.map((item) => (
            <Link key={item.href} href={item.href} className={styles.link}>
              {item.label}
            </Link>
          ))}
          <Link href="/login" className={styles.link}>
            Espace club
          </Link>
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href} className={styles.link}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
