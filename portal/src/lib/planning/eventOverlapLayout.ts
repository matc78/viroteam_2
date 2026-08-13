/** Plage horaire d'un événement pour le packing côte à côte. */
export type TimedEventSpan = {
  id: string;
  startMinutes: number;
  endMinutes: number;
};

/** Résultat du layout Google Calendar (colonnes dans un cluster). */
export type PackedEventLayout = TimedEventSpan & {
  column: number;
  columnCount: number;
  /** Identifiant du cluster de chevauchement (même groupe que le packing). */
  clusterId: number;
};

/**
 * Place les événements qui se chevauchent en colonnes côte à côte
 * (algorithme de clusters transitifs, style Google Calendar).
 */
export function packOverlappingEvents(
  events: TimedEventSpan[],
): PackedEventLayout[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (left, right) =>
      left.startMinutes - right.startMinutes ||
      right.endMinutes - left.endMinutes ||
      left.id.localeCompare(right.id),
  );

  const clusters: TimedEventSpan[][] = [];
  let currentCluster: TimedEventSpan[] = [];
  let clusterEnd = -1;

  for (const event of sorted) {
    if (currentCluster.length === 0 || event.startMinutes < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
      clusterEnd = event.endMinutes;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const packed: PackedEventLayout[] = [];
  clusters.forEach((cluster, clusterId) => {
    const columnEnds: number[] = [];
    const assigned = cluster.map((event) => {
      let column = columnEnds.findIndex(
        (endMinutes) => endMinutes <= event.startMinutes,
      );
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(event.endMinutes);
      } else {
        columnEnds[column] = event.endMinutes;
      }
      return { ...event, column, clusterId };
    });
    const columnCount = Math.max(columnEnds.length, 1);
    for (const item of assigned) {
      packed.push({ ...item, columnCount });
    }
  });
  return packed;
}

/**
 * Retourne les ids du cluster de chevauchement contenant `eventId`
 * (même groupe que le packing colonnes, via `clusterId`).
 */
export function overlappingClusterIds(
  eventId: string,
  events: PackedEventLayout[],
): Set<string> {
  const target = events.find((event) => event.id === eventId);
  if (!target) return new Set();
  return new Set(
    events
      .filter((event) => event.clusterId === target.clusterId)
      .map((event) => event.id),
  );
}
