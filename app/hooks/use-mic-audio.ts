import { useRef, useCallback, useState } from "react";

export function useMicAudio() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bufRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(0) as Uint8Array<ArrayBuffer>);
  const rafRef = useRef<number>(0);

  // Exposed amplitude ref: 0–1, smoothed EMA
  const amplitudeRef = useRef<number>(0);

  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string>("");

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    analyser.getByteFrequencyData(bufRef.current);
    const buf = bufRef.current;
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] / 255;
      sum += v * v;
    }
    const raw = Math.sqrt(sum / buf.length);
    // Exponential moving average: fast attack, medium release
    amplitudeRef.current =
      raw > amplitudeRef.current
        ? amplitudeRef.current * 0.5 + raw * 0.5
        : amplitudeRef.current * 0.85 + raw * 0.15;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startMic = useCallback(async () => {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      bufRef.current = new Uint8Array(analyser.frequencyBinCount);
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      setIsListening(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setMicError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, [tick]);

  const stopMic = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    audioCtxRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    amplitudeRef.current = 0;
    setIsListening(false);
  }, []);

  return { amplitudeRef, isListening, micError, startMic, stopMic };
}
