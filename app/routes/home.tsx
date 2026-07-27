import { useCallback, useEffect, useState } from "react";
import { IconArrowsMinimize, IconPhoto, IconVector } from "@tabler/icons-react";
import { useAsciiCamera } from "~/hooks/use-ascii-camera";
import type { AsciiParams } from "~/hooks/use-ascii-camera";
import { useMicAudio } from "~/hooks/use-mic-audio";
import { AsciiCanvas } from "~/components/ascii-canvas/ascii-canvas";
import { ControlPanel } from "~/components/control-panel/control-panel";
import { Toolbar } from "~/components/toolbar/toolbar";
import { StatusBar } from "~/components/status-bar/status-bar";
import styles from "./home.module.css";

export default function Home() {
  const { amplitudeRef, isListening, startMic, stopMic } = useMicAudio();

  const {
    videoRef,
    canvasRef,
    isActive,
    cameras,
    selectedCameraId,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    updateParams,
    snapshot,
    paramsRef,
  } = useAsciiCamera(amplitudeRef);

  const [params, setParams] = useState<AsciiParams>(() => paramsRef.current);
  const [galleryMode, setGalleryMode] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  const handleParamChange = useCallback(
    (updates: Partial<AsciiParams>) => {
      updateParams(updates);
      setParams((prev) => ({ ...prev, ...updates }));
    },
    [updateParams]
  );

  const handleStart = useCallback(() => {
    startCamera(selectedCameraId || undefined);
  }, [startCamera, selectedCameraId]);

  const handleToggleInvert = useCallback(() => {
    handleParamChange({ inverted: !params.inverted });
  }, [handleParamChange, params.inverted]);

  const handleToggleMic = useCallback(() => {
    if (isListening) stopMic();
    else startMic();
  }, [isListening, startMic, stopMic]);

  const handleToggleMelt = useCallback(() => {
    handleParamChange({ meltEnabled: !params.meltEnabled });
  }, [handleParamChange, params.meltEnabled]);

  const handleToggleMorph = useCallback(() => {
    handleParamChange({ morphEnabled: !params.morphEnabled });
  }, [handleParamChange, params.morphEnabled]);

  const exitGallery = useCallback(() => setGalleryMode(false), []);

  useEffect(() => {
    if (!galleryMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryMode]);

  return (
    <div className={`${styles.layout} ${galleryMode ? styles.gallery : ""}`}>
      {/* Hidden video element for camera feed */}
      <video ref={videoRef} className={styles.hiddenVideo} muted playsInline />

      {!galleryMode && (
        <Toolbar
          isActive={isActive}
          inverted={params.inverted}
          isMicActive={isListening}
          meltActive={params.meltEnabled}
          morphActive={params.morphEnabled}
          controlsOpen={controlsOpen}
          onStart={handleStart}
          onStop={stopCamera}
          onSnapshot={snapshot}
          onToggleInvert={handleToggleInvert}
          onEnterGallery={() => setGalleryMode(true)}
          onToggleMic={handleToggleMic}
          onToggleMelt={handleToggleMelt}
          onToggleMorph={handleToggleMorph}
          onToggleControls={() => setControlsOpen((o) => !o)}
        />
      )}

      <div className={styles.main}>
        <div className={styles.canvasWrapper}>
          <AsciiCanvas canvasRef={canvasRef} isActive={isActive} onStart={handleStart} />

          {!galleryMode && <StatusBar error={error} />}

          {galleryMode && (
            <div className={styles.galleryControls}>
              <button className={styles.galleryBtn} onClick={() => snapshot("png")} title="Save as PNG">
                <IconPhoto size={18} />
              </button>
              <button className={styles.galleryBtn} onClick={() => snapshot("svg")} title="Save as SVG">
                <IconVector size={18} />
              </button>
              <button className={styles.galleryBtn} onClick={exitGallery} title="Exit gallery mode (Esc)">
                <IconArrowsMinimize size={18} />
              </button>
            </div>
          )}
        </div>

        {!galleryMode && (
          <>
            {controlsOpen && (
              <div className={styles.backdrop} onClick={() => setControlsOpen(false)} aria-hidden="true" />
            )}
            <ControlPanel
              params={params}
              onParamChange={handleParamChange}
              cameras={cameras}
              selectedCameraId={selectedCameraId}
              onCameraChange={switchCamera}
              open={controlsOpen}
              onClose={() => setControlsOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
