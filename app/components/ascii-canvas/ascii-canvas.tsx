import type { RefObject } from "react";
import { IconPlayerPlayFilled } from "@tabler/icons-react";
import styles from "./ascii-canvas.module.css";

interface AsciiCanvasProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  onStart?: () => void;
}

export function AsciiCanvas({ canvasRef, isActive, onStart }: AsciiCanvasProps) {
  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} aria-label="Live ASCII art rendering" />

      <div className={styles.grain} aria-hidden="true" />

      {!isActive && (
        <div className={styles.placeholder}>
          <div className={styles.intro}>
            <p className={styles.introKicker}>a note before you begin</p>
            <div className={styles.introBody}>
              <p>
                clicking the button below asks permission to use your camera. everything runs locally in your browser.
                your video is never recorded, saved or sent to any server. the same goes for microphone mode which you
                can enable from the top bar.
              </p>
            </div>
            <button type="button" className={styles.playCta} onClick={onStart}>
              <IconPlayerPlayFilled size={18} />
              <span>allow camera &amp; begin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
