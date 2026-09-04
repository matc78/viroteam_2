"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TeamPageClient } from "@/app/(dashboard)/team/TeamPageClient";
import { AnnouncementsPageClient } from "@/app/(dashboard)/announcements/AnnouncementsPageClient";
import { EquipmentPageClient } from "@/app/(dashboard)/equipment/EquipmentPageClient";
import { FeesPageClient } from "@/app/(dashboard)/fees/FeesPageClient";
import { HomePageClient } from "@/app/(dashboard)/home/HomePageClient";
import { MembersPageClient } from "@/app/(dashboard)/members/MembersPageClient";
import { PlanningPageClient } from "@/app/(dashboard)/planning/PlanningPageClient";
import { SettingsPageClient } from "@/app/(dashboard)/settings/SettingsPageClient";
import styles from "./DashboardModulePanels.module.css";

type ModuleId =
  | "home"
  | "members"
  | "team"
  | "planning"
  | "fees"
  | "announcements"
  | "equipment"
  | "settings";

type ModuleDef = {
  id: ModuleId;
  match: (pathname: string) => boolean;
  render: () => ReactNode;
};

const MODULES: ModuleDef[] = [
  {
    id: "home",
    match: (pathname) => pathname === "/home" || pathname.startsWith("/home/"),
    render: () => <HomePageClient />,
  },
  {
    id: "members",
    match: (pathname) =>
      pathname === "/members" || pathname.startsWith("/members/"),
    render: () => <MembersPageClient />,
  },
  {
    id: "team",
    match: (pathname) => pathname === "/team" || pathname.startsWith("/team/"),
    render: () => <TeamPageClient />,
  },
  {
    id: "planning",
    match: (pathname) =>
      pathname === "/planning" || pathname.startsWith("/planning/"),
    render: () => <PlanningPageClient />,
  },
  {
    id: "fees",
    match: (pathname) => pathname === "/fees" || pathname.startsWith("/fees/"),
    render: () => <FeesPageClient />,
  },
  {
    id: "announcements",
    match: (pathname) =>
      pathname === "/announcements" || pathname.startsWith("/announcements/"),
    render: () => <AnnouncementsPageClient />,
  },
  {
    id: "equipment",
    match: (pathname) =>
      pathname === "/equipment" || pathname.startsWith("/equipment/"),
    render: () => <EquipmentPageClient />,
  },
  {
    id: "settings",
    match: (pathname) =>
      pathname === "/settings" || pathname.startsWith("/settings/"),
    render: () => <SettingsPageClient />,
  },
];

function resolveModuleId(pathname: string): ModuleId {
  return MODULES.find((module) => module.match(pathname))?.id ?? "home";
}

/**
 * Panneaux des modules espace club : montés une fois, puis affichés/masqués.
 * Évite le rechargement type page à chaque clic du menu (fluidité type app).
 */
export function DashboardModulePanels() {
  const pathname = usePathname();
  const activeId = resolveModuleId(pathname);
  const [mountedIds, setMountedIds] = useState(
    () => new Set<ModuleId>([activeId]),
  );

  useEffect(() => {
    setMountedIds((previous) => {
      if (previous.has(activeId)) return previous;
      const next = new Set(previous);
      next.add(activeId);
      return next;
    });
  }, [activeId]);

  return (
    <div className={styles.root}>
      {MODULES.map((module) => {
        if (!mountedIds.has(module.id)) return null;
        const isActive = module.id === activeId;
        return (
          <div
            key={module.id}
            className={isActive ? styles.panelActive : styles.panelHidden}
            hidden={!isActive}
            aria-hidden={!isActive}
          >
            {module.render()}
          </div>
        );
      })}
    </div>
  );
}
