import styles from "./DecorShapes.module.css";

/** Formes décoratives fixes — fond blanc du portal, sans animation. */
export function DecorShapes() {
  return (
    <div className={styles.layer} aria-hidden="true">
      <span className={`${styles.shape} ${styles.circleA}`} />
      <span className={`${styles.shape} ${styles.circleB}`} />
      <span className={`${styles.shape} ${styles.circleC}`} />
      <span className={`${styles.shape} ${styles.circleD}`} />
      <span className={`${styles.shape} ${styles.circleE}`} />
      <span className={`${styles.shape} ${styles.ringA}`} />
      <span className={`${styles.shape} ${styles.ringB}`} />
      <span className={`${styles.shape} ${styles.arcA}`} />
      <span className={`${styles.shape} ${styles.arcB}`} />
      <span className={`${styles.shape} ${styles.dotA}`} />
      <span className={`${styles.shape} ${styles.dotB}`} />
      <span className={`${styles.shape} ${styles.dotC}`} />
      <span className={`${styles.shape} ${styles.pill}`} />
      <span className={`${styles.shape} ${styles.square}`} />
    </div>
  );
}
