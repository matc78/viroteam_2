"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FamilyFeesClient } from "@/components/family/FamilyFeesClient";
import { FamilyHomeClient } from "@/components/family/FamilyHomeClient";
import { FamilyPlanningClient } from "@/components/family/FamilyPlanningClient";
import styles from "@/components/dashboard/DashboardModulePanels.module.css";

type ModuleId = "home" | "planning" | "fees";

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
    id: "planning",
    match: (pathname) =>
      pathname === "/family/planning" ||
      pathname.startsWith("/family/planning/"),
    render: () => <FamilyPlanningClient />,
  },
  {
    id: "fees",
    match: (pathname) =>
      pathname === "/family/fees" || pathname.startsWith("/family/fees/"),
    render: () => <FamilyFeesClient />,
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
  const [mountedIds, setMountedIds] = useState(() => new Set<ModuleId>([activeId]));

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
