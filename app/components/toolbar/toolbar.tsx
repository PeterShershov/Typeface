import { useEffect, useRef, useState } from "react";
import {
  IconPlayerPlay,
  IconPlayerStop,
  IconDeviceFloppy,
  IconSun,
  IconMoon,
  IconArrowsMaximize,
  IconMicrophone,
  IconMicrophoneOff,
  IconPhoto,
  IconVector,
  IconAdjustmentsHorizontal,
  IconSpiral,
  IconWaveSine,
  IconBrandGithub,
} from "@tabler/icons-react";
import type { ExportFormat } from "~/hooks/use-ascii-camera";
import styles from "./toolbar.module.css";

interface ToolbarProps {
  isActive: boolean;
  inverted: boolean;
  isMicActive: boolean;
  meltActive: boolean;
  morphActive: boolean;
  controlsOpen: boolean;
  onStart: () => void;
  onStop: () => void;
  onSnapshot: (format: ExportFormat) => void;
  onToggleInvert: () => void;
  onEnterGallery: () => void;
  onToggleMic: () => void;
  onToggleMelt: () => void;
  onToggleMorph: () => void;
  onToggleControls: () => void;
}

export function Toolbar({
  isActive,
  inverted,
  isMicActive,
  meltActive,
  morphActive,
  controlsOpen,
  onStart,
  onStop,
  onSnapshot,
  onToggleInvert,
  onEnterGallery,
  onToggleMic,
  onToggleMelt,
  onToggleMorph,
  onToggleControls,
}: ToolbarProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const saveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!saveOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) {
        setSaveOpen(false);
      }
    };
    window.addEventListener("mousedown", onDocClick);
    return () => window.removeEventListener("mousedown", onDocClick);
  }, [saveOpen]);

  const handleSave = (format: ExportFormat) => {
    setSaveOpen(false);
    onSnapshot(format);
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.actions}>
        {isActive ? (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={onStop} title="Stop camera">
            <IconPlayerStop size={14} />
          </button>
        ) : (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={onStart} title="Start camera">
            <IconPlayerPlay size={14} />
          </button>
        )}

        <div className={styles.saveWrap} ref={saveRef}>
          <button
            className={`${styles.btn} ${saveOpen ? styles.btnActive : ""}`}
            onClick={() => setSaveOpen((o) => !o)}
            disabled={!isActive}
            title="Save snapshot"
            aria-haspopup="menu"
            aria-expanded={saveOpen}
          >
            <IconDeviceFloppy size={14} />
          </button>

          {saveOpen && (
            <div className={styles.menu} role="menu">
              <button className={styles.menuItem} role="menuitem" onClick={() => handleSave("png")}>
                <IconPhoto size={14} />
                <span>Save as PNG</span>
              </button>
              <button className={styles.menuItem} role="menuitem" onClick={() => handleSave("svg")}>
                <IconVector size={14} />
                <span>Save as SVG</span>
              </button>
            </div>
          )}
        </div>

        <button
          className={`${styles.btn} ${inverted ? styles.btnActive : ""}`}
          onClick={onToggleInvert}
          disabled={!isActive}
          title="Toggle invert"
          aria-pressed={inverted}
        >
          {inverted ? <IconMoon size={14} /> : <IconSun size={14} />}
        </button>

        <button
          className={`${styles.btn} ${isMicActive ? styles.btnMic : ""}`}
          onClick={onToggleMic}
          disabled={!isActive}
          title={isMicActive ? "Disable mic reactivity" : "Enable mic reactivity"}
          aria-pressed={isMicActive}
        >
          {isMicActive ? <IconMicrophoneOff size={14} /> : <IconMicrophone size={14} />}
        </button>

        <button
          className={`${styles.btn} ${meltActive ? styles.btnActive : ""}`}
          onClick={onToggleMelt}
          disabled={!isActive}
          title={meltActive ? "Disable Mode #001" : "Enable Mode #001"}
          aria-pressed={meltActive}
        >
          <IconSpiral size={14} />
        </button>

        <button
          className={`${styles.btn} ${morphActive ? styles.btnActive : ""}`}
          onClick={onToggleMorph}
          disabled={!isActive}
          title={morphActive ? "Disable Mode #002" : "Enable Mode #002"}
          aria-pressed={morphActive}
        >
          <IconWaveSine size={14} />
        </button>

        <button
          className={`${styles.btn} ${styles.controlsBtn} ${controlsOpen ? styles.btnActive : ""}`}
          onClick={onToggleControls}
          disabled={!isActive}
          title="Toggle controls"
          aria-pressed={controlsOpen}
          aria-label="Toggle controls"
        >
          <IconAdjustmentsHorizontal size={14} />
        </button>
      </div>

      <div className={styles.actionsRight}>
        <button
          className={styles.btn}
          onClick={onEnterGallery}
          disabled={!isActive}
          title="Enter gallery mode"
          aria-label="Fullscreen"
        >
          <IconArrowsMaximize size={14} />
        </button>

        <a
          className={`${styles.btn} ${styles.linkBtn}`}
          href="https://github.com/PeterShershov/typeface"
          target="_blank"
          rel="noreferrer noopener"
          title="View source on GitHub"
          aria-label="View source on GitHub"
        >
          <IconBrandGithub size={14} />
        </a>
      </div>
    </div>
  );
}
