import styles from "./status-bar.module.css";

interface StatusBarProps {
  error: string;
}

export function StatusBar({ error }: StatusBarProps) {
  if (!error) return null;

  return (
    <div className={`${styles.bar} ${styles.error}`}>
      <span className={styles.dot} />
      <span>{error}</span>
    </div>
  );
}
