import { useCallback, useRef, useState } from "react";
import { Switch } from "radix-ui";
import { IconChevronDown } from "@tabler/icons-react";
import type { AsciiParams, CharSet, ColorMode } from "~/hooks/use-ascii-camera";
import styles from "./control-panel.module.css";

interface ControlPanelProps {
  params: AsciiParams;
  onParamChange: (updates: Partial<AsciiParams>) => void;
  cameras: MediaDeviceInfo[];
  selectedCameraId: string;
  onCameraChange: (deviceId: string) => void;
  open: boolean;
  onClose: () => void;
}

const COLOR_OPTIONS: { value: ColorMode; label: string; swatch: string }[] = [
  // Multi-color / full spectrum
  { value: "truecolor", label: "True Color", swatch: "linear-gradient(90deg,#ff0055,#ffcc00,#00ff88,#00aaff,#aa00ff)" },
  { value: "spectrum", label: "Spectrum", swatch: "linear-gradient(90deg,#5a00ff,#00c3ff,#00ff6a,#ffe600,#ff3b3b)" },
  // Synthwave / neon
  { value: "neon", label: "Neon", swatch: "linear-gradient(90deg,#001428,#00ffff,#ff00c8)" },
  { value: "cyberpunk", label: "Cyberpunk", swatch: "linear-gradient(90deg,#0a0019,#ff00c8,#00ffff)" },
  // Cool blues
  { value: "ice", label: "Ice", swatch: "linear-gradient(90deg,#001427,#0088ff,#aef1ff,#ffffff)" },
  { value: "ocean", label: "Ocean", swatch: "linear-gradient(90deg,#000814,#0077b6,#90e0ef)" },
  // Warm reds
  { value: "heat", label: "Heat", swatch: "linear-gradient(90deg,#1a0500,#ff3b00,#ffcc00,#ffffff)" },
  { value: "burgundy", label: "Burgundy", swatch: "linear-gradient(90deg,#1c0408,#800820,#dc1e3c)" },
  { value: "raspberry", label: "Raspberry", swatch: "linear-gradient(90deg,#140418,#a01430,#ff5082)" },
  // Greens
  { value: "phosphor", label: "Phosphor", swatch: "linear-gradient(90deg,#001a0e,#00ff88)" },
  { value: "toxic", label: "Toxic", swatch: "linear-gradient(90deg,#0a1a00,#7dff00,#c8ff5a)" },
  // Earth / warm neutrals
  { value: "amber", label: "Amber", swatch: "linear-gradient(90deg,#1a0e00,#ffb000)" },
  { value: "sepia", label: "Sepia", swatch: "linear-gradient(90deg,#2a1c10,#e8c9a0)" },
  // Soft / achromatic
  { value: "pastel", label: "Pastel", swatch: "linear-gradient(90deg,#ffd6e8,#d6f5ff,#e3ffd6,#fff3c4)" },
  { value: "mono", label: "Mono", swatch: "linear-gradient(90deg,#000000,#ffffff)" },
  { value: "blackwhite", label: "Black & White", swatch: "linear-gradient(90deg,#000000 50%,#ffffff 50%)" },
];

const CHAR_SET_OPTIONS: { value: CharSet; label: string; preview: string }[] = [
  { value: "standard", label: "Classic", preview: "freedom" },
  { value: "detailed", label: "Detailed", preview: "freedom" },
  { value: "blocks", label: "Blocks", preview: "█▓▒░" },
  { value: "minimal", label: "Dots", preview: "●◉○" },
  { value: "binary", label: "Binary", preview: "01" },
  { value: "greek", label: "Greek", preview: "ελευθερία" },
  { value: "hebrew", label: "Hebrew", preview: "חופש" },
  { value: "arabic", label: "Arabic", preview: "حرية" },
  { value: "katakana", label: "Katakana", preview: "フリーダム" },
  { value: "cyrillic", label: "Cyrillic", preview: "свобода" },
  { value: "korean", label: "Korean", preview: "자유" },
  { value: "chinese", label: "Chinese", preview: "自由" },
  { value: "devanagari", label: "Devanagari", preview: "स्वतंत्र" },
  { value: "thai", label: "Thai", preview: "เสรีภาพ" },
  { value: "armenian", label: "Armenian", preview: "ազատություն" },
  { value: "georgian", label: "Georgian", preview: "თავისუფ" },
  { value: "hiragana", label: "Hiragana", preview: "じゆう" },
  { value: "bengali", label: "Bengali", preview: "স্বাধীন" },
  { value: "tamil", label: "Tamil", preview: "சுதந்திரம்" },
  { value: "telugu", label: "Telugu", preview: "స్వేచ్ఛ" },
  { value: "kannada", label: "Kannada", preview: "ಸ್ವಾತಂತ್ರ್ಯ" },
  { value: "malayalam", label: "Malayalam", preview: "സ്വാതന്ത്ര്യം" },
  { value: "gujarati", label: "Gujarati", preview: "સ્વતંત્ર" },
  { value: "gurmukhi", label: "Gurmukhi", preview: "ਆਜ਼ਾਦੀ" },
  { value: "oriya", label: "Odia", preview: "ସ୍ୱାଧୀନ" },
  { value: "sinhala", label: "Sinhala", preview: "නිදහස" },
  { value: "tibetan", label: "Tibetan", preview: "རང་དབང་" },
  { value: "mongolian", label: "Mongolian", preview: "ᠴᠢᠯᠦᠭᠡ" },
  { value: "lao", label: "Lao", preview: "ເສລີພາບ" },
  { value: "khmer", label: "Khmer", preview: "សេរីភាព" },
  { value: "myanmar", label: "Burmese", preview: "လွတ်လပ်" },
  { value: "ethiopic", label: "Ethiopic", preview: "ነጻነት" },
  { value: "cherokee", label: "Cherokee", preview: "ᎤᏬᏢᏗ" },
  { value: "runic", label: "Runic", preview: "ᚠᚱᛁᛞᛟᛗ" },
  { value: "ogham", label: "Ogham", preview: "ᚃᚱᚔᚇᚑᚋ" },
  { value: "coptic", label: "Coptic", preview: "ⲙⲉⲧⲣⲉⲙϩⲉ" },
  { value: "glagolitic", label: "Glagolitic", preview: "ⱄⰲⱁⰱⱁⰴⰰ" },
  { value: "syriac", label: "Syriac", preview: "ܚܐܪܘܬܐ" },
  { value: "thaana", label: "Thaana", preview: "މިނިވަންކަން" },
  { value: "nko", label: "N'Ko", preview: "ߤߏߙߏߦߊ" },
  { value: "vai", label: "Vai", preview: "ꖴꔓꔤꖟ" },
  { value: "bamum", label: "Bamum", preview: "ꚭꚳꚩꚴ" },
  { value: "tifinagh", label: "Tifinagh", preview: "ⵜⵉⵍⴻⵍⵍⵉ" },
  { value: "cham", label: "Cham", preview: "ꨯꨮꨟꨯꨱ" },
  { value: "balinese", label: "Balinese", preview: "ᬓᬁᬤᬾᬓ" },
  { value: "javanese", label: "Javanese", preview: "ꦩꦂꦢꦶꦏ" },
  { value: "sundanese", label: "Sundanese", preview: "ᮊᮛᮓᮨᮊ" },
  { value: "batak", label: "Batak", preview: "ᯔᯒᯑᯉ" },
  { value: "lepcha", label: "Lepcha", preview: "ᰕᰛᰌᰉ" },
  { value: "limbu", label: "Limbu", preview: "ᤔᤖᤍᤏ" },
  { value: "baybayin", label: "Baybayin", preview: "ᜋᜎᜇᜌ" },
  { value: "buhid", label: "Buhid", preview: "ᝋᝍᝆᝊ" },
  { value: "hanunoo", label: "Hanuno'o", preview: "ᜫᜮᜧᜩ" },
  { value: "saurashtra", label: "Saurashtra", preview: "ꢪꢬꢣꢫ" },
  { value: "phagspa", label: "Phags-pa", preview: "ꡖꡘꡊꡙ" },
  { value: "taile", label: "Tai Le", preview: "ᥖᥲᥘᥤᥖ" },
  { value: "newtailue", label: "New Tai Lue", preview: "ᦖᦵᦟᦲᦖ" },
  { value: "taiviet", label: "Tai Viet", preview: "ꪠꪥꪒꪮꪣ" },
  { value: "kayahli", label: "Kayah Li", preview: "ꤠꤦꤛꤢ" },
  { value: "rejang", label: "Rejang", preview: "ꤴꤽꤴꤸꤶ" },
  { value: "meeteimayek", label: "Meetei Mayek", preview: "ꯐꯔꯗꯑꯃ" },
  { value: "olchiki", label: "Ol Chiki", preview: "ᱯᱨᱫᱚᱢ" },
  { value: "sylotinagri", label: "Syloti Nagri", preview: "ꠙꠞꠖꠝ" },
  { value: "yi", label: "Yi", preview: "ꃀꆈꄉꂷ" },
  { value: "canadian", label: "Canadian", preview: "ᕓᕂᑎᒧᒻ" },
];

export function ControlPanel({
  params,
  onParamChange,
  cameras,
  selectedCameraId,
  onCameraChange,
  open,
  onClose,
}: ControlPanelProps) {
  const [density, setDensity] = useState(params.density);
  const [brightness, setBrightness] = useState(params.brightness);
  const [contrast, setContrast] = useState(params.contrast);
  const [saturation, setSaturation] = useState(params.saturation);
  const [glow, setGlow] = useState(params.glow);
  const [customWord, setCustomWord] = useState(params.customWord);
  const [crtIntensity, setCrtIntensity] = useState(params.crtIntensity);
  const [crtSensitivity, setCrtSensitivity] = useState(params.crtSensitivity);
  const [crtDensity, setCrtDensity] = useState(params.crtDensity);
  const [crtOpen, setCrtOpen] = useState(false);
  const [meltIntensity, setMeltIntensity] = useState(params.meltIntensity);
  const [meltOpen, setMeltOpen] = useState(false);
  const [morphIntensity, setMorphIntensity] = useState(params.morphIntensity);
  const [morphOpen, setMorphOpen] = useState(false);
  const prevCharSetRef = useRef<CharSet>(params.charSet !== "custom" ? params.charSet : "standard");
  if (params.charSet !== "custom") {
    prevCharSetRef.current = params.charSet;
  }

  const makeHandler = useCallback(
    (setter: (v: number) => void, key: keyof AsciiParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      setter(val);
      onParamChange({ [key]: val } as Partial<AsciiParams>);
    },
    [onParamChange],
  );

  const handleWordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setCustomWord(val);
      onParamChange({ customWord: val });
    },
    [onParamChange],
  );

  const handleCustomModeToggle = useCallback(
    (checked: boolean) => {
      onParamChange({ charSet: checked ? "custom" : prevCharSetRef.current });
    },
    [onParamChange],
  );

  const handleCrtToggle = useCallback(
    (checked: boolean) => {
      onParamChange({ crtEnabled: checked });
    },
    [onParamChange],
  );

  const handleMeltToggle = useCallback(
    (checked: boolean) => {
      onParamChange({ meltEnabled: checked });
    },
    [onParamChange],
  );

  const handleMorphToggle = useCallback(
    (checked: boolean) => {
      onParamChange({ morphEnabled: checked });
    },
    [onParamChange],
  );

  const handleMorphHueDriftToggle = useCallback(
    (checked: boolean) => {
      onParamChange({ morphHueDrift: checked });
    },
    [onParamChange],
  );

  return (
    <aside className={`${styles.panel} ${open ? styles.panelOpen : ""}`}>
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Palette</span>
        <div className={styles.colorGrid}>
          {COLOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onParamChange({ colorMode: opt.value })}
              className={`${styles.colorBtn} ${params.colorMode === opt.value ? styles.colorBtnActive : ""}`}
              aria-pressed={params.colorMode === opt.value}
            >
              <span className={styles.swatch} style={{ background: opt.swatch }} />
              <span className={styles.colorLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Image</span>

        <div className={styles.control}>
          <label className={styles.label}>
            <span>Saturation</span>
            <span className={styles.value}>{saturation.toFixed(2)}×</span>
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={saturation}
            onChange={makeHandler(setSaturation, "saturation")}
            className={styles.slider}
            aria-label="Saturation"
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label}>
            <span>Glow</span>
            <span className={styles.value}>{Math.round(glow * 100)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={glow}
            onChange={makeHandler(setGlow, "glow")}
            className={styles.slider}
            aria-label="Glow bloom"
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label}>
            <span>Brightness</span>
            <span className={styles.value}>{brightness > 0 ? `+${brightness}` : brightness}</span>
          </label>
          <input
            type="range"
            min={-100}
            max={100}
            step={5}
            value={brightness}
            onChange={makeHandler(setBrightness, "brightness")}
            className={styles.slider}
            aria-label="Brightness"
          />
        </div>

        <div className={styles.control}>
          <label className={styles.label}>
            <span>Contrast</span>
            <span className={styles.value}>{contrast.toFixed(1)}×</span>
          </label>
          <input
            type="range"
            min={0.5}
            max={3.0}
            step={0.1}
            value={contrast}
            onChange={makeHandler(setContrast, "contrast")}
            className={styles.slider}
            aria-label="Contrast"
          />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionTitle}>Detail</span>
        <div className={styles.control}>
          <label className={styles.label}>
            <span>Density</span>
            <span className={styles.value}>{density}</span>
          </label>
          <input
            type="range"
            min={20}
            max={300}
            step={2}
            value={density}
            onChange={makeHandler(setDensity, "density")}
            className={styles.slider}
            aria-label="Character density"
          />
          <div className={styles.sliderHints}>
            <span>Coarse</span>
            <span>Fine</span>
          </div>
        </div>

        <div className={styles.control}>
          <span className={styles.label}>
            <span>Character Set</span>
          </span>
          <div className={styles.charSetGrid}>
            {CHAR_SET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onParamChange({ charSet: opt.value })}
                className={`${styles.charSetBtn} ${params.charSet === opt.value ? styles.charSetBtnActive : ""}`}
                title={opt.preview}
                aria-pressed={params.charSet === opt.value}
              >
                <span className={styles.charSetPreview}>{opt.preview}</span>
                <span className={styles.charSetLabel}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.control}>
          <label className={styles.label} htmlFor="custom-word">
            <span>Custom</span>
          </label>
          <div className={styles.inputRow}>
            <input
              id="custom-word"
              type="text"
              value={customWord}
              onChange={handleWordChange}
              placeholder="e.g. freedom"
              maxLength={32}
              disabled={params.charSet !== "custom"}
              className={styles.textInput}
              aria-label="Custom word for ASCII glyphs"
            />
            <Switch.Root
              className={styles.switchRoot}
              checked={params.charSet === "custom"}
              onCheckedChange={handleCustomModeToggle}
              aria-label="Toggle custom word mode"
            >
              <Switch.Thumb className={styles.switchThumb} />
            </Switch.Root>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <button
            type="button"
            className={styles.sectionToggleBtn}
            onClick={() => setCrtOpen((o) => !o)}
            aria-expanded={crtOpen}
          >
            <span className={styles.sectionTitle}>CRT Display</span>
            <IconChevronDown size={16} className={`${styles.chevron} ${crtOpen ? styles.chevronOpen : ""}`} />
          </button>
          <Switch.Root
            className={styles.switchRoot}
            checked={params.crtEnabled}
            onCheckedChange={handleCrtToggle}
            aria-label="Toggle CRT scanline overlay"
          >
            <Switch.Thumb className={styles.switchThumb} />
          </Switch.Root>
        </div>

        {crtOpen && (
          <>
            <div className={styles.control}>
              <label className={styles.label}>
                <span>Intensity</span>
                <span className={styles.value}>{Math.round(crtIntensity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={crtIntensity}
                onChange={makeHandler(setCrtIntensity, "crtIntensity")}
                className={styles.slider}
                disabled={!params.crtEnabled}
                aria-label="CRT intensity"
              />
            </div>

            <div className={styles.control}>
              <label className={styles.label}>
                <span>Sensitivity</span>
                <span className={styles.value}>{Math.round(crtSensitivity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={crtSensitivity}
                onChange={makeHandler(setCrtSensitivity, "crtSensitivity")}
                className={styles.slider}
                disabled={!params.crtEnabled}
                aria-label="CRT audio sensitivity"
              />
            </div>

            <div className={styles.control}>
              <label className={styles.label}>
                <span>Density</span>
                <span className={styles.value}>{Math.round(crtDensity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={crtDensity}
                onChange={makeHandler(setCrtDensity, "crtDensity")}
                className={styles.slider}
                disabled={!params.crtEnabled}
                aria-label="CRT scanline density"
              />
              <div className={styles.sliderHints}>
                <span>Sparse</span>
                <span>Dense</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <button
            type="button"
            className={styles.sectionToggleBtn}
            onClick={() => setMeltOpen((o) => !o)}
            aria-expanded={meltOpen}
          >
            <span className={styles.sectionTitle}>Mode #001</span>
            <IconChevronDown size={16} className={`${styles.chevron} ${meltOpen ? styles.chevronOpen : ""}`} />
          </button>
          <Switch.Root
            className={styles.switchRoot}
            checked={params.meltEnabled}
            onCheckedChange={handleMeltToggle}
            aria-label="Toggle Mode #001"
          >
            <Switch.Thumb className={styles.switchThumb} />
          </Switch.Root>
        </div>

        {meltOpen && (
          <>
            <div className={styles.control}>
              <label className={styles.label}>
                <span>Intensity</span>
                <span className={styles.value}>{Math.round(meltIntensity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={meltIntensity}
                onChange={makeHandler(setMeltIntensity, "meltIntensity")}
                className={styles.slider}
                disabled={!params.meltEnabled}
                aria-label="Mode #001 intensity"
              />
              <div className={styles.sliderHints}>
                <span>Subtle</span>
                <span>Melting</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <button
            type="button"
            className={styles.sectionToggleBtn}
            onClick={() => setMorphOpen((o) => !o)}
            aria-expanded={morphOpen}
          >
            <span className={styles.sectionTitle}>Mode #002</span>
            <IconChevronDown size={16} className={`${styles.chevron} ${morphOpen ? styles.chevronOpen : ""}`} />
          </button>
          <Switch.Root
            className={styles.switchRoot}
            checked={params.morphEnabled}
            onCheckedChange={handleMorphToggle}
            aria-label="Toggle Mode #002"
          >
            <Switch.Thumb className={styles.switchThumb} />
          </Switch.Root>
        </div>

        {morphOpen && (
          <>
            <div className={styles.control}>
              <label className={styles.label}>
                <span>Intensity</span>
                <span className={styles.value}>{Math.round(morphIntensity * 100)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={morphIntensity}
                onChange={makeHandler(setMorphIntensity, "morphIntensity")}
                className={styles.slider}
                disabled={!params.morphEnabled}
                aria-label="Mode #002 intensity"
              />
              <div className={styles.sliderHints}>
                <span>Gentle</span>
                <span>Dissolving</span>
              </div>
            </div>

            <div className={styles.control}>
              <div className={styles.inputRow}>
                <label className={styles.label} style={{ flex: 1 }} htmlFor="morph-hue-drift">
                  <span>Hue drift</span>
                </label>
                <Switch.Root
                  id="morph-hue-drift"
                  className={styles.switchRoot}
                  checked={params.morphHueDrift}
                  onCheckedChange={handleMorphHueDriftToggle}
                  disabled={!params.morphEnabled}
                  aria-label="Toggle Mode #002 hue drift"
                >
                  <Switch.Thumb className={styles.switchThumb} />
                </Switch.Root>
              </div>
            </div>
          </>
        )}
      </div>

      {cameras.length > 1 && (
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Source</span>
          <div className={styles.control}>
            <label className={styles.label} htmlFor="camera-select">
              <span>Camera</span>
            </label>
            <select
              id="camera-select"
              value={selectedCameraId}
              onChange={(e) => onCameraChange(e.target.value)}
              className={styles.select}
            >
              {cameras.map((cam, i) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </aside>
  );
}
