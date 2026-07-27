import { useRef, useCallback, useEffect, useState } from "react";
import { WebGPUAsciiRenderer, tryCreateWebGPURenderer } from "./use-webgpu-renderer";

export type CharSet =
  | "standard"
  | "detailed"
  | "blocks"
  | "minimal"
  | "binary"
  | "hebrew"
  | "arabic"
  | "greek"
  | "katakana"
  | "cyrillic"
  | "korean"
  | "chinese"
  | "devanagari"
  | "thai"
  | "armenian"
  | "georgian"
  | "hiragana"
  | "bengali"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "gujarati"
  | "gurmukhi"
  | "oriya"
  | "sinhala"
  | "tibetan"
  | "mongolian"
  | "lao"
  | "khmer"
  | "myanmar"
  | "ethiopic"
  | "cherokee"
  | "runic"
  | "ogham"
  | "coptic"
  | "glagolitic"
  | "syriac"
  | "thaana"
  | "nko"
  | "vai"
  | "bamum"
  | "tifinagh"
  | "cham"
  | "balinese"
  | "javanese"
  | "sundanese"
  | "batak"
  | "lepcha"
  | "limbu"
  | "baybayin"
  | "buhid"
  | "hanunoo"
  | "saurashtra"
  | "phagspa"
  | "taile"
  | "newtailue"
  | "taiviet"
  | "kayahli"
  | "rejang"
  | "meeteimayek"
  | "olchiki"
  | "sylotinagri"
  | "yi"
  | "canadian"
  | "custom";

export type ColorMode =
  | "truecolor"
  | "phosphor"
  | "amber"
  | "neon"
  | "sepia"
  | "spectrum"
  | "heat"
  | "ice"
  | "burgundy"
  | "mono"
  | "blackwhite"
  | "pastel"
  | "toxic"
  | "ocean"
  | "raspberry"
  | "cyberpunk";

export interface AsciiParams {
  density: number;       // 20–300 cols
  brightness: number;    // -100 to 100
  contrast: number;      // 0.5 to 3.0
  saturation: number;    // 0 to 2
  glow: number;          // 0 to 1
  customWord: string;
  charSet: CharSet;
  colorMode: ColorMode;
  inverted: boolean;
  crtEnabled: boolean;     // master toggle for CRT scanline overlay
  crtIntensity: number;    // 0 to 1 — baseline opacity & thickness
  crtSensitivity: number;  // 0 to 1 — audio reactivity of speed & opacity
  crtDensity: number;      // 0 to 1 — number of scanlines (spacing)
  meltEnabled: boolean;     // audio-reactive smudge/melt feedback trails
  meltIntensity: number;    // 0 to 1 — strength of the smudge distortion
  morphEnabled: boolean;     // glyph-morph wave field
  morphIntensity: number;    // 0 to 1 — strength of the character morphing
  morphHueDrift: boolean;    // slow hue-rotation color wash tied to morph
}

// Each language script spells the word "freedom" in its own writing system.
// The abstract ramps (standard/detailed/blocks/minimal/binary/custom) stay as
// luminance gradients. Historic/rare scripts without a standard modern word use
// a phonetic transliteration of "freedom".
const CHAR_SETS: Record<CharSet, string> = {
  standard: "@#S%?*+;:,. ",
  detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'. ",
  blocks: "█▓▒░ ",
  minimal: "●◉○ ",
  binary: "10 ",
  hebrew: "חופש ",
  arabic: "حرية ",
  greek: "ελευθερία ",
  katakana: "フリーダム ",
  cyrillic: "свобода ",
  korean: "자유 ",
  chinese: "自由 ",
  devanagari: "स्वतंत्रता ",
  thai: "เสรีภาพ ",
  armenian: "ազատություն ",
  georgian: "თავისუფლება ",
  hiragana: "じゆう ",
  bengali: "স্বাধীনতা ",
  tamil: "சுதந்திரம் ",
  telugu: "స్వేచ్ఛ ",
  kannada: "ಸ್ವಾತಂತ್ರ್ಯ ",
  malayalam: "സ്വാതന്ത്ര്യം ",
  gujarati: "સ્વતંત્રતા ",
  gurmukhi: "ਆਜ਼ਾਦੀ ",
  oriya: "ସ୍ୱାଧୀନତା ",
  sinhala: "නිදහස ",
  tibetan: "རང་དབང་ ",
  mongolian: "ᠴᠢᠯᠦᠭᠡ ",
  lao: "ເສລີພາບ ",
  khmer: "សេរីភាព ",
  myanmar: "လွတ်လပ်ရေး ",
  ethiopic: "ነጻነት ",
  cherokee: "ᎤᏬᏢᏗ ",
  runic: "ᚠᚱᛁᛞᛟᛗ ",
  ogham: "ᚃᚱᚔᚇᚑᚋ ",
  coptic: "ⲙⲉⲧⲣⲉⲙϩⲉ ",
  glagolitic: "ⱄⰲⱁⰱⱁⰴⰰ ",
  syriac: "ܚܐܪܘܬܐ ",
  thaana: "މިނިވަންކަން ",
  nko: "ߤߏߙߏߦߊ ",
  vai: "ꖴꔓꔤꖟ ",
  bamum: "ꚭꚳꚩꚴ ",
  tifinagh: "ⵜⵉⵍⴻⵍⵍⵉ ",
  cham: "ꨯꨮꨟꨯꨱ ",
  balinese: "ᬓᬁᬤᬾᬓ ",
  javanese: "ꦩꦂꦢꦶꦏ ",
  sundanese: "ᮊᮛᮓᮨᮊ ",
  batak: "ᯔᯒᯑᯉ ",
  lepcha: "ᰕᰛᰌᰉ ",
  limbu: "ᤔᤖᤍᤏ ",
  baybayin: "ᜋᜎᜇᜌ ",
  buhid: "ᝋᝍᝆᝊ ",
  hanunoo: "ᜫᜮᜧᜩ ",
  saurashtra: "ꢪꢬꢣꢫ ",
  phagspa: "ꡖꡘꡊꡙ ",
  taile: "ᥖᥲᥘᥤᥖ ",
  newtailue: "ᦖᦵᦟᦲᦖ ",
  taiviet: "ꪠꪥꪒꪮꪣ ",
  kayahli: "ꤠꤦꤛꤢ ",
  rejang: "ꤴꤽꤴꤸꤶ ",
  meeteimayek: "ꯐꯔꯗꯑꯃ ",
  olchiki: "ᱯᱨᱫᱚᱢ ",
  sylotinagri: "ꠙꠞꠖꠝ ",
  yi: "ꃀꆈꄉꂷ ",
  canadian: "ᕓᕂᑎᒧᒻ ",
  custom: "@#*+:. ",
};

function applyBrightnessContrast(value: number, brightness: number, contrast: number): number {
  const v = ((value - 128) * contrast + 128 + brightness) | 0;
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export type ExportFormat = "png" | "svg";

function escapeXml(ch: string): string {
  switch (ch) {
    case "&": return "&amp;";
    case "<": return "&lt;";
    case ">": return "&gt;";
    case '"': return "&quot;";
    case "'": return "&apos;";
    default:  return ch;
  }
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  link.click();
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

function rgbHue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

function pixelColor(
  mode: ColorMode, r: number, g: number, b: number, luma: number,
  brightness: number, contrast: number, saturation: number
): [number, number, number] {
  switch (mode) {
    case "truecolor": {
      let R = applyBrightnessContrast(r, brightness, contrast);
      let G = applyBrightnessContrast(g, brightness, contrast);
      let B = applyBrightnessContrast(b, brightness, contrast);
      const l = 0.299 * R + 0.587 * G + 0.114 * B;
      R = clamp01((l + (R - l) * saturation) / 255) * 255;
      G = clamp01((l + (G - l) * saturation) / 255) * 255;
      B = clamp01((l + (B - l) * saturation) / 255) * 255;
      return [R | 0, G | 0, B | 0];
    }
    case "neon": {
      const h = rgbHue(r, g, b);
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return hslToRgb(h, Math.min(1, 0.55 + saturation * 0.35), 0.22 + t * 0.55);
    }
    case "spectrum": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return hslToRgb((1 - t) * 300, 0.85, 0.22 + t * 0.5);
    }
    case "phosphor": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(t * t * 120) | 0, (Math.pow(t, 0.72) * 255) | 0, (t * t * 165) | 0];
    }
    case "amber": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(Math.pow(t, 0.75) * 255) | 0, (t * t * 155) | 0, (t * t * t * 32) | 0];
    }
    case "sepia": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(Math.pow(t, 0.8) * 255) | 0, (t * 205) | 0, (t * t * 155) | 0];
    }
    case "heat": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      const s = 1 + saturation * 0.4;
      return [(clamp01(t * 3 * s) * 255) | 0, (clamp01((t * 3 - 1) * s) * 255) | 0, (clamp01((t * 3 - 2) * s) * 255) | 0];
    }
    case "ice": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(clamp01(t * 3 - 2) * 255) | 0, (Math.pow(t, 0.85) * 220) | 0, (Math.pow(t, 0.55) * 255) | 0];
    }
    case "burgundy": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
      let R: number, G: number, B: number;
      if (t < 0.5) { const k = t * 2; R = lerp(28, 128, k); G = lerp(4, 12, k); B = lerp(10, 28, k); }
      else { const k = (t - 0.5) * 2; R = lerp(128, 220, k); G = lerp(12, 30, k); B = lerp(28, 60, k); }
      return [R | 0, G | 0, B | 0];
    }
    case "mono": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      const v = (Math.pow(t, 0.9) * 255) | 0;
      return [v, v, v];
    }
    case "blackwhite": {
      const lb = applyBrightnessContrast(luma, brightness, contrast);
      const v = lb > 128 ? 255 : 0;
      return [v, v, v];
    }
    case "pastel": {
      const h = rgbHue(r, g, b);
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return hslToRgb(h, Math.min(1, 0.4 + saturation * 0.2), 0.58 + t * 0.32);
    }
    case "toxic": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(t * 90) | 0, (Math.pow(t, 0.6) * 255) | 0, (t * t * 45) | 0];
    }
    case "ocean": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      return [(t * t * 25) | 0, (Math.pow(t, 0.7) * 180) | 0, (Math.pow(t, 0.5) * 255) | 0];
    }
    case "raspberry": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
      let R: number, G: number, B: number;
      if (t < 0.5) { const k = t * 2; R = lerp(20, 160, k); G = lerp(4, 20, k); B = lerp(30, 60, k); }
      else { const k = (t - 0.5) * 2; R = lerp(160, 255, k); G = lerp(20, 80, k); B = lerp(60, 130, k); }
      return [R | 0, G | 0, B | 0];
    }
    case "cyberpunk": {
      const t = clamp01(applyBrightnessContrast(luma, brightness, contrast) / 255);
      const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
      let R: number, G: number, B: number;
      if (t < 0.5) { const k = t * 2; R = lerp(10, 255, k); G = lerp(0, 0, k); B = lerp(25, 200, k); }
      else { const k = (t - 0.5) * 2; R = lerp(255, 0, k); G = lerp(0, 255, k); B = lerp(200, 255, k); }
      return [R | 0, G | 0, B | 0];
    }
    default: {
      const R = applyBrightnessContrast(r, brightness, contrast);
      const G = applyBrightnessContrast(g, brightness, contrast);
      const B = applyBrightnessContrast(b, brightness, contrast);
      return [R, G, B];
    }
  }
}

export function useAsciiCamera(audioAmplitudeRef?: { current: number }) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef      = useRef<HTMLCanvasElement | null>(null);

  const crtPatternRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);
  const crtScrollRef  = useRef(0);
  const crtAmpRef     = useRef(0);
  const crtTimeRef    = useRef(performance.now());

  const meltBufRef   = useRef<HTMLCanvasElement | null>(null);
  const meltAmpRef   = useRef(0);
  const meltAngleRef = useRef(0);

  const animFrameRef  = useRef<number>(0);
  const streamRef     = useRef<MediaStream | null>(null);
  const colorCacheRef = useRef<(string | undefined)[]>(new Array(32768));

  // WebGPU renderer + cell data buffer
  const gpuRendererRef = useRef<WebGPUAsciiRenderer | null>(null);
  const cellDataRef    = useRef<Float32Array>(new Float32Array(512 * 4));

  const [isActive, setIsActive]   = useState(false);
  const [cameraLabel, setCameraLabel] = useState("");
  const [cameras, setCameras]     = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [error, setError]         = useState<string>("");

  const paramsRef = useRef<AsciiParams>({
    density: 100,
    brightness: 6,
    contrast: 1.25,
    saturation: 1.35,
    glow: 0.45,
    customWord: "",
    charSet: "standard",
    colorMode: "truecolor",
    inverted: false,
    crtEnabled: false,
    crtIntensity: 0.5,
    crtSensitivity: 0.6,
    crtDensity: 0.5,
    meltEnabled: false,
    meltIntensity: 0.1,
    morphEnabled: false,
    morphIntensity: 0.6,
    morphHueDrift: false,
  });

  const loadCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);
      if (videoDevices.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoDevices[0].deviceId);
      }
    } catch {
      // permissions not yet granted, will retry after stream starts
    }
  }, [selectedCameraId]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);

    // Dispose WebGPU renderer if active
    if (gpuRendererRef.current) {
      gpuRendererRef.current.dispose();
      gpuRendererRef.current = null;
    } else {
      // Canvas 2D clear only when not using WebGPU
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    meltAmpRef.current = 0;
    if (meltBufRef.current) {
      const bctx = meltBufRef.current.getContext("2d");
      bctx?.clearRect(0, 0, meltBufRef.current.width, meltBufRef.current.height);
    }
  }, []);

  const renderFrame = useCallback(() => {
    const canvas    = canvasRef.current;
    const video     = videoRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !video || !offscreen || video.readyState < 2 || !video.videoWidth) {
      animFrameRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const params = paramsRef.current;
    const dpr    = Math.min(window.devicePixelRatio || 1, 2);
    const cssW   = canvas.clientWidth  || 1;
    const cssH   = canvas.clientHeight || 1;
    const W = Math.round(cssW * dpr);
    const H = Math.round(cssH * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }

    const cols = params.density;
    const rows = Math.max(1, Math.round((cols * video.videoHeight) / video.videoWidth / 2));

    offscreen.width  = cols;
    offscreen.height = rows;
    const octx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!octx) { animFrameRef.current = requestAnimationFrame(renderFrame); return; }

    octx.drawImage(video, 0, 0, cols, rows);
    const data = octx.getImageData(0, 0, cols, rows).data;

    const cellW  = Math.max(W / cols, H / (rows * 2));
    const cellH  = cellW * 2;
    const gridW  = cellW * cols;
    const gridH  = cellH * rows;
    const offsetX = (W - gridW) / 2;
    const offsetY = (H - gridH) / 2;
    const fontSize = cellW * 1.5;

    const chars =
      params.charSet === "custom" && params.customWord.trim().length > 0
        ? params.customWord + " "
        : CHAR_SETS[params.charSet] ?? CHAR_SETS.standard;
    const charCount = chars.length;
    const { colorMode, brightness, contrast, saturation, inverted } = params;

    const rawAmp   = audioAmplitudeRef ? audioAmplitudeRef.current : 0;
    const audioAmp = Math.min(1, rawAmp * 1.6);
    const ampSq    = audioAmp * audioAmp;
    const animTime = performance.now() * 0.001;
    const chaosRange = Math.floor(ampSq * charCount);

    const morphEnabled = params.morphEnabled;
    const morphAmount   = params.morphIntensity * (0.55 + audioAmp * 0.9);
    const morphHueDeg  =
      morphEnabled && params.morphHueDrift
        ? (animTime * (20 + audioAmp * 80) * params.morphIntensity) % 360
        : 0;
    const morphTime  = animTime * (0.6 + params.morphIntensity * 1.6 + audioAmp * 2.2);
    const cxCenter = cols / 2;
    const cyCenter = rows / 2;

    // ── WebGPU path ──────────────────────────────────────────────────────────
    const gpuRenderer = gpuRendererRef.current;
    if (gpuRenderer) {
      // Update glyph atlas if charset changed
      gpuRenderer.buildAtlas(chars);

      // Ensure cell data buffer is large enough
      const totalCells = cols * rows;
      if (cellDataRef.current.length < totalCells * 4) {
        cellDataRef.current = new Float32Array(totalCells * 4 * 2);
      }
      const cd = cellDataRef.current;

      // CPU loop: compute charIdx + color for each cell → Float32Array
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ci     = row * cols + col;
          const srcCol = cols - 1 - col; // mirror for natural selfie view
          const px     = (row * cols + srcCol) * 4;
          const r = data[px], g = data[px + 1], b = data[px + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          const lb         = applyBrightnessContrast(luma, brightness, contrast);
          const normalized = inverted ? lb / 255 : 1 - lb / 255;
          let charIdx      = (normalized * charCount) | 0;
          if (charIdx >= charCount) charIdx = charCount - 1;

          if (morphEnabled && morphAmount > 0.001) {
            const dxc  = col - cxCenter;
            const dyc  = row - cyCenter;
            const wave =
              Math.sin(col * 0.25 + morphTime * 1.3) +
              Math.sin(row * 0.3  - morphTime * 1.1) +
              Math.sin((col + row) * 0.18 + morphTime * 0.7) +
              Math.sin(Math.sqrt(dxc * dxc + dyc * dyc) * 0.22 - morphTime * 1.6);
            const shift = Math.round(((wave + 4) / 8) * charCount * morphAmount);
            charIdx = ((charIdx + shift) % charCount + charCount) % charCount;
          }
          if (chaosRange > 1) {
            const noise = (Math.abs(Math.sin(col * 12.9898 + row * 78.233 + animTime * 25)) * chaosRange) | 0;
            charIdx = (charIdx + noise) % charCount;
          }

          const [cr, cg, cb] = pixelColor(colorMode, r, g, b, luma, brightness, contrast, saturation);
          cd[ci * 4]     = charIdx;
          cd[ci * 4 + 1] = cr / 255;
          cd[ci * 4 + 2] = cg / 255;
          cd[ci * 4 + 3] = cb / 255;
        }
      }

      const effectiveGlow = params.glow + ampSq * 0.9;

      // CRT scroll tracking
      let crtScrollY = 0, crtOpacity = 0, crtPeriod = 4;
      if (params.crtEnabled) {
        crtAmpRef.current += (audioAmp - crtAmpRef.current) * 0.12;
        const sAmp = crtAmpRef.current;
        crtPeriod = Math.max(2, Math.round((8 - params.crtDensity * 5) * dpr));
        const now2 = performance.now();
        const dt   = Math.min(0.05, (now2 - crtTimeRef.current) / 1000);
        crtTimeRef.current = now2;
        crtScrollRef.current = (crtScrollRef.current + (14 * dpr + sAmp * params.crtSensitivity * 260 * dpr) * dt) % crtPeriod;
        crtScrollY = crtScrollRef.current;
        crtOpacity = Math.min(0.85, (0.1 + params.crtIntensity * 0.5) + sAmp * params.crtSensitivity * 0.4);
      }

      // Melt param tracking
      let meltDx = 0, meltDy = 0, meltZoom = 1, meltSwirl = 0, meltPersistence = 0.9, meltBlurPx = 0;
      if (params.meltEnabled) {
        meltAmpRef.current   += (audioAmp - meltAmpRef.current) * 0.15;
        const sAmp      = meltAmpRef.current;
        const intensity = params.meltIntensity;
        meltAngleRef.current += (0.1 + sAmp * 1.8) * 0.016;
        const ang   = meltAngleRef.current;
        meltZoom        = 1 + (0.006 + sAmp * 0.05) * intensity;
        meltSwirl       = (0.003 + sAmp * 0.05) * intensity;
        const push  = (1.5 + sAmp * 34) * intensity;
        meltDx       = Math.cos(ang) * push;
        meltDy       = Math.sin(ang * 1.3) * push;
        meltPersistence = 0.9 + intensity * 0.06;
        meltBlurPx   = (0.3 + sAmp * 1.4) * intensity;
      }

      gpuRenderer.render({
        cellData: cd, cols, rows, charCount,
        cellW, cellH, gridOffX: offsetX, gridOffY: offsetY, W, H,
        effectiveGlow, morphHueDeg, inverted,
        meltEnabled: params.meltEnabled, meltDx, meltDy, meltZoom, meltSwirl, meltPersistence, meltBlurPx,
        crtEnabled: params.crtEnabled, crtScrollY, crtOpacity, crtPeriod,
      });
    }

    // ── Canvas 2D fallback path (unchanged) ──────────────────────────────────
    else {
      if (!glowRef.current) glowRef.current = document.createElement("canvas");
      const glow = glowRef.current;
      if (glow.width !== W || glow.height !== H) { glow.width = W; glow.height = H; }

      const ctx  = canvas.getContext("2d");
      const gctx = glow.getContext("2d");
      if (!ctx || !gctx) { animFrameRef.current = requestAnimationFrame(renderFrame); return; }

      const cache = colorCacheRef.current;

      gctx.clearRect(0, 0, W, H);
      gctx.font      = `${fontSize}px 'JetBrains Mono', monospace`;
      gctx.textAlign = "center";
      gctx.textBaseline = "middle";

      for (let row = 0; row < rows; row++) {
        const cy = offsetY + row * cellH + cellH / 2;
        for (let col = 0; col < cols; col++) {
          const srcCol = cols - 1 - col;
          const idx  = (row * cols + srcCol) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;

          const lb         = applyBrightnessContrast(luma, brightness, contrast);
          const normalized = inverted ? lb / 255 : 1 - lb / 255;
          let charIdx      = (normalized * charCount) | 0;
          if (charIdx >= charCount) charIdx = charCount - 1;

          if (morphEnabled && morphAmount > 0.001) {
            const dxc  = col - cxCenter;
            const dyc  = row - cyCenter;
            const wave =
              Math.sin(col * 0.25 + morphTime * 1.3) +
              Math.sin(row * 0.3  - morphTime * 1.1) +
              Math.sin((col + row) * 0.18 + morphTime * 0.7) +
              Math.sin(Math.sqrt(dxc * dxc + dyc * dyc) * 0.22 - morphTime * 1.6);
            const shift = Math.round(((wave + 4) / 8) * charCount * morphAmount);
            charIdx = charIdx + shift;
            charIdx = ((charIdx % charCount) + charCount) % charCount;
          }
          if (chaosRange > 1) {
            const noise = (Math.abs(Math.sin(col * 12.9898 + row * 78.233 + animTime * 25)) * chaosRange) | 0;
            charIdx = (charIdx + noise) % charCount;
          }
          const ch = chars[charIdx];
          if (ch === " ") continue;

          const [cr, cg, cb] = pixelColor(colorMode, r, g, b, luma, brightness, contrast, saturation);
          const key  = ((cr >> 3) << 10) | ((cg >> 3) << 5) | (cb >> 3);
          let style  = cache[key];
          if (!style) { style = `rgb(${cr},${cg},${cb})`; cache[key] = style; }
          gctx.fillStyle = style;

          const drawX = offsetX + col * cellW + cellW / 2;
          gctx.fillText(ch, drawX, cy);
        }
      }

      // Composite
      ctx.fillStyle = inverted ? "#ece7de" : "#050505";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = morphHueDeg ? `hue-rotate(${morphHueDeg.toFixed(1)}deg)` : "none";
      ctx.drawImage(glow, 0, 0);
      ctx.filter = "none";

      // Bloom
      const effectiveGlow = params.glow + ampSq * 0.9;
      if (effectiveGlow > 0 && !inverted) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(1, effectiveGlow * 0.9);
        ctx.filter = `blur(${effectiveGlow * cellH * 1.1}px)${morphHueDeg ? ` hue-rotate(${morphHueDeg.toFixed(1)}deg)` : ""}`;
        ctx.drawImage(glow, 0, 0);
        ctx.restore();
      }

      // Melt smudge
      if (params.meltEnabled) {
        if (!meltBufRef.current) meltBufRef.current = document.createElement("canvas");
        const buf = meltBufRef.current;
        if (buf.width !== W || buf.height !== H) { buf.width = W; buf.height = H; }
        const bctx = buf.getContext("2d");
        if (bctx) {
          meltAmpRef.current   += (audioAmp - meltAmpRef.current) * 0.15;
          const sAmp      = meltAmpRef.current;
          const intensity = params.meltIntensity;
          meltAngleRef.current += (0.1 + sAmp * 1.8) * 0.016;
          const ang       = meltAngleRef.current;
          const zoom      = 1 + (0.006 + sAmp * 0.05) * intensity;
          const swirl     = (0.003 + sAmp * 0.05) * intensity;
          const push      = (1.5 + sAmp * 34) * intensity * dpr;
          const dx        = Math.cos(ang) * push;
          const dy        = Math.sin(ang * 1.3) * push;
          const persistence = 0.9 + intensity * 0.06;

          bctx.save();
          bctx.globalCompositeOperation = "copy";
          bctx.globalAlpha = persistence;
          bctx.filter = `blur(${(0.3 + sAmp * 1.4) * intensity * dpr}px)`;
          bctx.translate(W / 2 + dx, H / 2 + dy);
          bctx.rotate(swirl);
          bctx.scale(zoom, zoom);
          bctx.drawImage(buf, -W / 2, -H / 2, W, H);
          bctx.restore();

          bctx.save();
          bctx.globalCompositeOperation = "source-over";
          bctx.globalAlpha = 1;
          bctx.filter = morphHueDeg ? `hue-rotate(${morphHueDeg.toFixed(1)}deg)` : "none";
          bctx.drawImage(glow, 0, 0);
          bctx.restore();

          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          ctx.filter = "none";
          ctx.drawImage(buf, 0, 0);
          const ca = sAmp * intensity * 7 * dpr;
          if (ca > 0.6) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 0.5;
            ctx.drawImage(buf, -ca, 0);
            ctx.drawImage(buf, ca, 0);
          }
          ctx.restore();
        }
      }

      // CRT scanlines
      if (params.crtEnabled) {
        crtAmpRef.current += (audioAmp - crtAmpRef.current) * 0.12;
        const sAmp = crtAmpRef.current;
        const sens = params.crtSensitivity;
        const period = Math.max(2, Math.round((8 - params.crtDensity * 5) * dpr));
        const thick  = 0.28 + params.crtIntensity * 0.32;
        const patKey = `${period}:${Math.round(thick * 40)}`;

        let pat = crtPatternRef.current;
        if (!pat || pat.key !== patKey) {
          const pc   = document.createElement("canvas");
          pc.width   = 1;
          pc.height  = period;
          const pctx = pc.getContext("2d");
          if (pctx) {
            const grad = pctx.createLinearGradient(0, 0, 0, period);
            grad.addColorStop(0, "rgba(0,0,0,0.95)");
            grad.addColorStop(Math.min(0.95, thick), "rgba(0,0,0,0)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            pctx.fillStyle = grad;
            pctx.fillRect(0, 0, 1, period);
          }
          pat = { canvas: pc, key: patKey };
          crtPatternRef.current = pat;
        }

        const now2 = performance.now();
        const dt   = Math.min(0.05, (now2 - crtTimeRef.current) / 1000);
        crtTimeRef.current = now2;
        const idleSpeed  = 14 * dpr;
        const audioSpeed = sAmp * sens * 260 * dpr;
        crtScrollRef.current = (crtScrollRef.current + (idleSpeed + audioSpeed) * dt) % period;

        const baseOpacity = 0.1 + params.crtIntensity * 0.5;
        const opacity     = Math.min(0.85, baseOpacity + sAmp * sens * 0.4);

        const pattern = ctx.createPattern(pat.canvas, "repeat");
        if (pattern) {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = opacity;
          ctx.filter = "none";
          ctx.fillStyle = pattern;
          ctx.translate(0, crtScrollRef.current);
          ctx.fillRect(0, -period, W, H + period);
          ctx.restore();
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(renderFrame);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCamera = useCallback(
    async (deviceId?: string) => {
      setError("");
      stopCamera();

      try {
        // ── Try WebGPU before any Canvas 2D context is obtained ──────────────
        const canvas = canvasRef.current;
        if (canvas && navigator.gpu) {
          try {
            const renderer = await tryCreateWebGPURenderer(canvas);
            if (renderer) {
              gpuRendererRef.current = renderer;
            }
          } catch {
            gpuRendererRef.current = null;
          }
        }

        // ── Start camera stream ───────────────────────────────────────────────
        const constraints: MediaStreamConstraints = {
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setCameras(videoDevices);

        const track = stream.getVideoTracks()[0];
        setCameraLabel(track?.label || "Camera");
        if (!offscreenRef.current) {
          offscreenRef.current = document.createElement("canvas");
        }

        setIsActive(true);
        animFrameRef.current = requestAnimationFrame(renderFrame);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Camera access denied";
        setError(msg);
        setIsActive(false);
      }
    },
    [stopCamera, renderFrame]
  );

  const switchCamera = useCallback(
    (deviceId: string) => {
      setSelectedCameraId(deviceId);
      if (isActive) startCamera(deviceId);
    },
    [isActive, startCamera]
  );

  const updateParams = useCallback((updates: Partial<AsciiParams>) => {
    paramsRef.current = { ...paramsRef.current, ...updates };
  }, []);

  const snapshotPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive) return;
    triggerDownload(canvas.toDataURL("image/png"), `typeface-${Date.now()}.png`);
  }, [isActive]);

  const snapshotSvg = useCallback(() => {
    const video     = videoRef.current;
    const offscreen = offscreenRef.current;
    if (!video || !offscreen || !isActive || video.readyState < 2 || !video.videoWidth) return;

    const params = paramsRef.current;
    const cols   = params.density;
    const rows   = Math.max(1, Math.round((cols * video.videoHeight) / video.videoWidth / 2));

    offscreen.width  = cols;
    offscreen.height = rows;
    const octx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!octx) return;
    octx.drawImage(video, 0, 0, cols, rows);
    const data = octx.getImageData(0, 0, cols, rows).data;

    const cellW  = 10;
    const cellH  = cellW * 2;
    const fontSize = cellW * 1.5;
    const width  = cols * cellW;
    const height = rows * cellH;

    const chars =
      params.charSet === "custom" && params.customWord.trim().length > 0
        ? params.customWord + " "
        : CHAR_SETS[params.charSet] ?? CHAR_SETS.standard;
    const charCount = chars.length;
    const { colorMode, brightness, contrast, saturation, inverted } = params;

    let body = "";
    for (let row = 0; row < rows; row++) {
      const cy = row * cellH + cellH / 2;
      for (let col = 0; col < cols; col++) {
        const srcCol = cols - 1 - col;
        const idx  = (row * cols + srcCol) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;

        const lb         = applyBrightnessContrast(luma, brightness, contrast);
        const normalized = inverted ? lb / 255 : 1 - lb / 255;
        let charIdx      = (normalized * charCount) | 0;
        if (charIdx >= charCount) charIdx = charCount - 1;
        const ch = chars[charIdx];
        if (ch === " ") continue;

        const [cr, cg, cb] = pixelColor(colorMode, r, g, b, luma, brightness, contrast, saturation);
        const cx = col * cellW + cellW / 2;
        body += `<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" fill="rgb(${cr},${cg},${cb})">${escapeXml(ch)}</text>`;
      }
    }

    const bg  = inverted ? "#ece7de" : "#050505";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="100%" height="100%" fill="${bg}"/>` +
      `<g font-family="'JetBrains Mono', ui-monospace, monospace" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">` +
      body +
      `</g></svg>`;

    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    triggerDownload(url, `typeface-${Date.now()}.svg`);
    URL.revokeObjectURL(url);
  }, [isActive]);

  const snapshot = useCallback(
    (format: ExportFormat = "png") => {
      if (format === "svg") snapshotSvg();
      else snapshotPng();
    },
    [snapshotPng, snapshotSvg]
  );

  useEffect(() => {
    loadCameras();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    videoRef,
    canvasRef,
    isActive,
    cameraLabel,
    cameras,
    selectedCameraId,
    error,
    startCamera,
    stopCamera,
    switchCamera,
    updateParams,
    snapshot,
    paramsRef,
  };
}
