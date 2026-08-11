import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import { site } from "@/lib/site";
import styles from "./DashboardShell.module.css";

type DashboardShellProps = {
  clubName: string;
  adminDisplayName: string;
  children: ReactNode;
};

/** Coquille espace club : header bureau sur fond blanc partagé. */
export function DashboardShell({
  clubName,
  adminDisplayName,
  children,
}: DashboardShellProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Link
              href="/home"
              className={styles.brand}
              aria-label={`${site.name} — espace club`}
            >
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
            <span className={styles.clubDivider} aria-hidden="true" />
            <span className={styles.clubName}>{clubName}</span>
          </div>

          <div className={styles.actions}>
            <span className={styles.roleChip}>Admin</span>
            <span className={styles.userName}>{adminDisplayName}</span>
            <Link href="/" className={styles.siteLink}>
              Site public
            </Link>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
