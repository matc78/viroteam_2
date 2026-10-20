"use client";

import dynamic from "next/dynamic";
import { ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import { preloadWhenIdle } from "@/lib/ui/preloadWhenIdle";
import styles from "./DashboardModulePanels.module.css";

// Un chunk JS par module : seul le module ouvert est chargé au premier affichage,
// les autres sont préchargés quand le navigateur est libre.
const loadHome = () => import("@/app/(dashboard)/home/HomePageClient");
const loadMembers = () => import("@/app/(dashboard)/members/MembersPageClient");
const loadTeam = () => import("@/app/(dashboard)/team/TeamPageClient");
const loadPlanning = () => import("@/app/(dashboard)/planning/PlanningPageClient");
const loadPersonalPlanning = () =>
  import("@/components/dashboard/PersonalPlanningClient");
const loadMessages = () => import("@/components/chat/MessagesPageClient");
const loadFees = () => import("@/app/(dashboard)/fees/FeesPageClient");
const loadAnnouncements = () =>
  import("@/app/(dashboard)/announcements/AnnouncementsPageClient");
const loadActivity = () => import("@/app/(dashboard)/activity/ActivityPageClient");
const loadEquipment = () => import("@/app/(dashboard)/equipment/EquipmentPageClient");
const loadSettings = () => import("@/app/(dashboard)/settings/SettingsPageClient");

const HomePageClient = dynamic(() => loadHome().then((m) => m.HomePageClient), {
  loading: () => <DashboardSkeleton variant="home" />,
});
const MembersPageClient = dynamic(
  () => loadMembers().then((m) => m.MembersPageClient),
  { loading: () => <DashboardSkeleton variant="members" /> },
);
const TeamPageClient = dynamic(() => loadTeam().then((m) => m.TeamPageClient), {
  loading: () => <DashboardSkeleton variant="members" />,
});
const PlanningPageClient = dynamic(
  () => loadPlanning().then((m) => m.PlanningPageClient),
  { loading: () => <DashboardSkeleton variant="planning" /> },
);
const PersonalPlanningClient = dynamic(
  () => loadPersonalPlanning().then((m) => m.PersonalPlanningClient),
  { loading: () => <DashboardSkeleton variant="planning" /> },
);
const MessagesPageClient = dynamic(
  () => loadMessages().then((m) => m.MessagesPageClient),
  { loading: () => <DashboardSkeleton variant="members" /> },
);
const FeesPageClient = dynamic(() => loadFees().then((m) => m.FeesPageClient), {
  loading: () => <DashboardSkeleton variant="fees" />,
});
const AnnouncementsPageClient = dynamic(
  () => loadAnnouncements().then((m) => m.AnnouncementsPageClient),
  { loading: () => <DashboardSkeleton variant="home" /> },
);
const ActivityPageClient = dynamic(
  () => loadActivity().then((m) => m.ActivityPageClient),
  { loading: () => <DashboardSkeleton variant="members" /> },
);
const EquipmentPageClient = dynamic(
  () => loadEquipment().then((m) => m.EquipmentPageClient),
  { loading: () => <DashboardSkeleton variant="members" /> },
);
const SettingsPageClient = dynamic(
  () => loadSettings().then((m) => m.SettingsPageClient),
  { loading: () => <DashboardSkeleton variant="home" /> },
);

const MODULE_LOADERS: Array<() => Promise<unknown>> = [
  loadHome,
  loadPlanning,
  loadMembers,
  loadFees,
  loadTeam,
  loadAnnouncements,
  loadPersonalPlanning,
  loadSettings,
  loadEquipment,
  loadActivity,
  ...(CHAT_MESSAGING_LIVE ? [loadMessages] : []),
];

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

  useEffect(() => preloadWhenIdle(MODULE_LOADERS), []);

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
