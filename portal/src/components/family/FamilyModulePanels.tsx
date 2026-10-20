"use client";

import dynamic from "next/dynamic";
import { ReactNode, Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { CHAT_MESSAGING_LIVE } from "@/lib/featureFlags";
import { preloadWhenIdle } from "@/lib/ui/preloadWhenIdle";
import styles from "@/components/dashboard/DashboardModulePanels.module.css";

// Un chunk JS par module (voir DashboardModulePanels).
const loadHome = () => import("@/components/family/FamilyHomeClient");
const loadTeam = () => import("@/components/family/FamilyTeamClient");
const loadPlanning = () => import("@/components/family/FamilyPlanningClient");
const loadPersonalPlanning = () =>
  import("@/components/dashboard/PersonalPlanningClient");
const loadMessages = () => import("@/components/chat/MessagesPageClient");
const loadFees = () => import("@/components/family/FamilyFeesClient");
const loadSettings = () => import("@/components/family/FamilySettingsClient");

const FamilyHomeClient = dynamic(
  () => loadHome().then((m) => m.FamilyHomeClient),
  { loading: () => <DashboardSkeleton variant="home" /> },
);
const FamilyTeamClient = dynamic(
  () => loadTeam().then((m) => m.FamilyTeamClient),
  { loading: () => <DashboardSkeleton variant="members" /> },
);
const FamilyPlanningClient = dynamic(
  () => loadPlanning().then((m) => m.FamilyPlanningClient),
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
const FamilyFeesClient = dynamic(
  () => loadFees().then((m) => m.FamilyFeesClient),
  { loading: () => <DashboardSkeleton variant="fees" /> },
);
const FamilySettingsClient = dynamic(
  () => loadSettings().then((m) => m.FamilySettingsClient),
  { loading: () => <DashboardSkeleton variant="home" /> },
);

const MODULE_LOADERS: Array<() => Promise<unknown>> = [
  loadHome,
  loadPlanning,
  loadTeam,
  loadFees,
  loadPersonalPlanning,
  loadSettings,
  ...(CHAT_MESSAGING_LIVE ? [loadMessages] : []),
];

type ModuleId =
  | "home"
  | "team"
  | "planning"
  | "my-planning"
  | "messages"
  | "fees"
  | "settings";

type ModuleDef = {
  id: ModuleId;
  match: (pathname: string) => boolean;
  render: () => ReactNode;
};

const MODULES: ModuleDef[] = [
  {
    id: "home",
    match: (pathname) => pathname === "/family",
    render: () => <FamilyHomeClient />,
  },
  {
    id: "team",
    match: (pathname) =>
      pathname === "/family/team" || pathname.startsWith("/family/team/"),
    render: () => <FamilyTeamClient />,
  },
  {
    id: "planning",
    match: (pathname) =>
      pathname === "/family/planning" ||
      pathname.startsWith("/family/planning/"),
    render: () => <FamilyPlanningClient />,
  },
  {
    id: "my-planning",
    match: (pathname) =>
      pathname === "/family/my-planning" ||
      pathname.startsWith("/family/my-planning/"),
    // Rendu dédié ci-dessous (isPanelActive pour keep-alive).
    render: () => null,
  },
  {
    id: "messages",
    match: (pathname) =>
      pathname === "/family/messages" ||
      pathname.startsWith("/family/messages/"),
    render: () => null,
  },
  {
    id: "fees",
    match: (pathname) =>
      pathname === "/family/fees" || pathname.startsWith("/family/fees/"),
    render: () => <FamilyFeesClient />,
  },
  {
    id: "settings",
    match: (pathname) =>
      pathname === "/family/settings" ||
      pathname.startsWith("/family/settings/"),
    render: () => <FamilySettingsClient />,
  },
];

function resolveModuleId(pathname: string): ModuleId {
  return MODULES.find((module) => module.match(pathname))?.id ?? "home";
}

/**
 * Panneaux espace famille : montés une fois, puis affichés/masqués.
 */
export function FamilyModulePanels() {
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
                eyebrow="Espace famille"
                isPanelActive={isActive}
              />
            ) : module.id === "messages" ? (
              <Suspense fallback={null}>
                <MessagesPageClient
                  eyebrow="Espace famille"
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
