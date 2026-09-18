"use client";

import { ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TeamPageClient } from "@/app/(dashboard)/team/TeamPageClient";
import { AnnouncementsPageClient } from "@/app/(dashboard)/announcements/AnnouncementsPageClient";
import { ActivityPageClient } from "@/app/(dashboard)/activity/ActivityPageClient";
import { EquipmentPageClient } from "@/app/(dashboard)/equipment/EquipmentPageClient";
import { FeesPageClient } from "@/app/(dashboard)/fees/FeesPageClient";
import { HomePageClient } from "@/app/(dashboard)/home/HomePageClient";
import { MembersPageClient } from "@/app/(dashboard)/members/MembersPageClient";
import { PlanningPageClient } from "@/app/(dashboard)/planning/PlanningPageClient";
import { PersonalPlanningClient } from "@/components/dashboard/PersonalPlanningClient";
import { MessagesPageClient } from "@/components/chat/MessagesPageClient";
import { SettingsPageClient } from "@/app/(dashboard)/settings/SettingsPageClient";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import styles from "./DashboardModulePanels.module.css";

type ModuleId =
  | "home"
  | "members"
  | "team"
  | "planning"
  | "my-planning"
  | "messages"
  | "fees"
  | "announcements"
  | "activity"
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
    id: "my-planning",
    match: (pathname) =>
      pathname === "/my-planning" || pathname.startsWith("/my-planning/"),
    // Rendu dédié ci-dessous (isPanelActive pour keep-alive).
    render: () => null,
  },
  {
    id: "messages",
    match: (pathname) =>
      pathname === "/messages" || pathname.startsWith("/messages/"),
    render: () => null,
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
    id: "activity",
    match: (pathname) =>
      pathname === "/activity" || pathname.startsWith("/activity/"),
    render: () => <ActivityPageClient />,
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
        if (module.id === "messages" && !CHAT_MESSAGING_LIVE) return null;
        if (!mountedIds.has(module.id)) return null;
        const isActive = module.id === activeId;
        return (
          <div
            key={module.id}
            className={isActive ? styles.panelActive : styles.panelHidden}
            hidden={!isActive}
            aria-hidden={!isActive}
          >
            {module.id === "my-planning" ? (
              <PersonalPlanningClient
                eyebrow="Espace club"
                isPanelActive={isActive}
              />
            ) : module.id === "messages" ? (
              <Suspense fallback={null}>
                <MessagesPageClient
                  eyebrow="Espace club"
                  isPanelActive={isActive}
                />
              </Suspense>
            ) : (
              module.render()
            )}
          </div>
        );
      })}
    </div>
  );
}
