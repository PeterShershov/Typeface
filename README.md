# Typeface

Your face, in type. A live camera-to-glyph renderer that runs in the browser.

Typeface samples the webcam, maps luminance onto a character ramp and draws it with WebGPU
(falling back to Canvas 2D).

## Features

- 16 color modes
- Mic reactivity driving glyph movement
- CRT scanline overlay
- Export to PNG or SVG

## Development

```sh
npm install
npm run dev
npm run typecheck
npm run build
```
