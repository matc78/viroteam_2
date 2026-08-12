import { formatDateId } from "@/lib/firebase/eventService";
import styles from "./PlanningDayPicker.module.css";

/** Props du sélecteur de jour horizontal. */
type PlanningDayPickerProps = {
  days: Date[];
  selectedDay: Date;
  onDaySelected: (day: Date) => void;
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Bandeau horizontal de sélection de jour (aligné app Flutter). */
export function PlanningDayPicker({
  days,
  selectedDay,
  onDaySelected,
}: PlanningDayPickerProps) {
  const today = new Date();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className={styles.wrapper} role="group" aria-label="Sélection du jour">
      <div className={styles.scroll}>
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDay);
          const isToday = isSameDay(day, todayDay);
          const isPast = day.getTime() < todayDay.getTime();
          const weekday = new Intl.DateTimeFormat("fr-FR", {
            weekday: "short",
          }).format(day);
          const dayNumber = day.getDate();

          return (
            <button
              key={formatDateId(day)}
              type="button"
              className={styles.dayButton}
              data-selected={isSelected ? "true" : "false"}
              data-today={isToday ? "true" : "false"}
              data-past={isPast ? "true" : "false"}
              onClick={() => onDaySelected(day)}
              aria-pressed={isSelected}
              aria-label={new Intl.DateTimeFormat("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(day)}
            >
              <span className={styles.weekday}>{weekday}</span>
              <span className={styles.dayNumber}>{dayNumber}</span>
              {isToday ? <span className={styles.todayDot} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
