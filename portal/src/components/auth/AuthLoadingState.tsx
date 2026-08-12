import styles from "./AuthLoadingState.module.css";

type AuthLoadingStateProps = {
  message?: string;
};

/** État de chargement centré pour pages auth et guards. */
export function AuthLoadingState({
  message = "Chargement…",
}: AuthLoadingStateProps) {
  return (
    <div className={styles.root} role="status">
      {message}
    </div>
  );
}
