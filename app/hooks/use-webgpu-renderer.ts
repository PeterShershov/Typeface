/**
 * WebGPU-accelerated ASCII renderer.
 * Instanced glyph quads + GPU bloom + GPU DMT warp + GPU CRT scanlines.
 * Gracefully returns null when WebGPU is unavailable.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const GLYPH_W = 32; // glyph atlas cell width in px
const GLYPH_H = 48; // glyph atlas cell height in px

// GPU usage flags — numeric to avoid tsconfig dependency on namespace globals
const BU = { UNIFORM: 0x40, STORAGE: 0x80, COPY_DST: 0x08 } as const;
const TU = { COPY_DST: 0x02, TEXTURE_BINDING: 0x04, STORAGE_BINDING: 0x08, RENDER_ATTACHMENT: 0x10 } as const;

// ─── WGSL Shaders ────────────────────────────────────────────────────────────

/** Render instanced monospace glyphs from a pre-built atlas texture */
const GLYPH_WGSL = `
struct Uni {
  canvasW: f32, canvasH: f32,
  gridOffX: f32, gridOffY: f32,
  cellW: f32, cellH: f32,
  cols: u32, rows: u32,
  numChars: f32, _p0: f32, _p1: f32, _p2: f32,
}
struct Cell { charIdx: f32, r: f32, g: f32, b: f32 }

@group(0) @binding(0) var<uniform>       uni   : Uni;
@group(0) @binding(1) var<storage, read> cells : array<Cell>;
@group(0) @binding(2) var atlasTex  : texture_2d<f32>;
@group(0) @binding(3) var atlasSamp : sampler;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv : vec2f,
  @location(1) col: vec3f,
  @location(2) ci : f32,
}

@vertex fn vs(
  @builtin(instance_index) ii: u32,
  @builtin(vertex_index)   vi: u32,
) -> VOut {
  var q = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0),
  );
  let lp   = q[vi];
  let col  = ii % uni.cols;
  let row  = ii / uni.cols;
  let cell = cells[ii];
  let px = uni.gridOffX + f32(col) * uni.cellW + lp.x * uni.cellW;
  let py = uni.gridOffY + f32(row) * uni.cellH + lp.y * uni.cellH;
  var o: VOut;
  o.pos = vec4f(px / uni.canvasW * 2.0 - 1.0, 1.0 - py / uni.canvasH * 2.0, 0.0, 1.0);
  o.uv  = lp;
  o.col = vec3f(cell.r, cell.g, cell.b);
  o.ci  = cell.charIdx;
  return o;
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let u = (in.ci + in.uv.x) / uni.numChars;
  let s = textureSample(atlasTex, atlasSamp, vec2f(u, in.uv.y));
  if (s.a < 0.02) { discard; }
  return vec4f(in.col, s.a);
}
`;

/** Horizontal Gaussian blur (unrolled 5-tap, step-driven by uniform) */
const BLUR_H_WGSL = `
struct P { w: u32, h: u32, step: f32, _pad: f32 }
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: P;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= p.w || gid.y >= p.h) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  let st = max(i32(p.step), 1);
  let iw = i32(p.w) - 1;
  var acc = vec4f(0.0);
  acc += textureLoad(src, vec2i(clamp(ix - 2*st, 0, iw), iy), 0) * 0.0625;
  acc += textureLoad(src, vec2i(clamp(ix - 1*st, 0, iw), iy), 0) * 0.25;
  acc += textureLoad(src, vec2i(ix,               iy), 0) * 0.375;
  acc += textureLoad(src, vec2i(clamp(ix + 1*st, 0, iw), iy), 0) * 0.25;
  acc += textureLoad(src, vec2i(clamp(ix + 2*st, 0, iw), iy), 0) * 0.0625;
  textureStore(dst, vec2i(ix, iy), acc);
}
`;

/** Vertical Gaussian blur (unrolled 5-tap) */
const BLUR_V_WGSL = `
struct P { w: u32, h: u32, step: f32, _pad: f32 }
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> p: P;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x >= p.w || gid.y >= p.h) { return; }
  let ix = i32(gid.x); let iy = i32(gid.y);
  let st = max(i32(p.step), 1);
  let ih = i32(p.h) - 1;
  var acc = vec4f(0.0);
  acc += textureLoad(src, vec2i(ix, clamp(iy - 2*st, 0, ih)), 0) * 0.0625;
  acc += textureLoad(src, vec2i(ix, clamp(iy - 1*st, 0, ih)), 0) * 0.25;
  acc += textureLoad(src, vec2i(ix, iy               ), 0) * 0.375;
  acc += textureLoad(src, vec2i(ix, clamp(iy + 1*st, 0, ih)), 0) * 0.25;
  acc += textureLoad(src, vec2i(ix, clamp(iy + 2*st, 0, ih)), 0) * 0.0625;
  textureStore(dst, vec2i(ix, iy), acc);
}
`;

/** DMT warp: inverse-transform previous frame and blend fresh glyphs on top */
const DMT_WGSL = `
struct P {
  canvasW: f32, canvasH: f32,
  dx: f32, dy: f32,
  zoom: f32, swirl: f32,
  persistence: f32, blurPx: f32,
  hueDeg: f32, _p0: f32, _p1: f32, _p2: f32,
}
@group(0) @binding(0) var prevTex  : texture_2d<f32>;
@group(0) @binding(1) var glyphBuf : texture_2d<f32>;
@group(0) @binding(2) var samp     : sampler;
@group(0) @binding(3) var<uniform> p: P;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let ndc = pos[vi];
  var o: VOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  var uv = ndc * 0.5 + 0.5; uv.y = 1.0 - uv.y;
  o.uv = uv;
  return o;
}

fn hueRot(c: vec3f, deg: f32) -> vec3f {
  let a = deg * 0.017453292;
  let cs = cos(a); let sn = sin(a);
  return vec3f(
    c.r*(0.213+cs*0.787-sn*0.213) + c.g*(0.715-cs*0.715-sn*0.715) + c.b*(0.072-cs*0.072+sn*0.928),
    c.r*(0.213-cs*0.213+sn*0.143) + c.g*(0.715+cs*0.285+sn*0.140) + c.b*(0.072-cs*0.072-sn*0.283),
    c.r*(0.213-cs*0.213-sn*0.787) + c.g*(0.715-cs*0.715+sn*0.715) + c.b*(0.072+cs*0.928+sn*0.072),
  );
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  // Inverse-warp current pixel to find its source in the previous frame
  let cx  = in.uv.x * p.canvasW - p.canvasW * 0.5;
  let cy  = in.uv.y * p.canvasH - p.canvasH * 0.5;
  let ucx = cx - p.dx; let ucy = cy - p.dy;
  let cs  = cos(-p.swirl); let sn = sin(-p.swirl);
  let rcx = ucx * cs - ucy * sn; let rcy = ucx * sn + ucy * cs;
  let srcU = (rcx / p.zoom + p.canvasW * 0.5) / p.canvasW;
  let srcV = (rcy / p.zoom + p.canvasH * 0.5) / p.canvasH;

  // 3×3 tent blur for organic trail softness
  let bpu = p.blurPx / p.canvasW; let bpv = p.blurPx / p.canvasH;
  var prev = vec4f(0.0);
  prev += textureSample(prevTex, samp, vec2f(srcU-bpu, srcV-bpv)) * 0.0625;
  prev += textureSample(prevTex, samp, vec2f(srcU,     srcV-bpv)) * 0.125;
  prev += textureSample(prevTex, samp, vec2f(srcU+bpu, srcV-bpv)) * 0.0625;
  prev += textureSample(prevTex, samp, vec2f(srcU-bpu, srcV))     * 0.125;
  prev += textureSample(prevTex, samp, vec2f(srcU,     srcV))     * 0.25;
  prev += textureSample(prevTex, samp, vec2f(srcU+bpu, srcV))     * 0.125;
  prev += textureSample(prevTex, samp, vec2f(srcU-bpu, srcV+bpv)) * 0.0625;
  prev += textureSample(prevTex, samp, vec2f(srcU,     srcV+bpv)) * 0.125;
  prev += textureSample(prevTex, samp, vec2f(srcU+bpu, srcV+bpv)) * 0.0625;

  prev *= p.persistence;
  if (p.hueDeg != 0.0) { prev = vec4f(hueRot(prev.rgb, p.hueDeg), prev.a); }

  let g = textureSample(glyphBuf, samp, in.uv);
  return vec4f(mix(prev.rgb, g.rgb, g.a), max(prev.a, g.a));
}
`;

/** Final composite: background + glyphs/DMT + additive bloom + CRT scanlines + hue rotation */
const COMPOSITE_WGSL = `
struct U {
  canvasW: f32, canvasH: f32,
  glowStr: f32, hueDeg: f32,
  inverted: u32, dmtEnabled: u32, crtEnabled: u32,
  crtScrollY: f32, crtPeriod: f32, crtOpacity: f32,
  _p0: f32, _p1: f32,
}
@group(0) @binding(0) var<uniform> uni     : U;
@group(0) @binding(1) var glyphTex : texture_2d<f32>;
@group(0) @binding(2) var dmtTex   : texture_2d<f32>;
@group(0) @binding(3) var bloomTex : texture_2d<f32>;
@group(0) @binding(4) var samp     : sampler;

struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var pos = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let ndc = pos[vi];
  var o: VOut;
  o.pos = vec4f(ndc, 0.0, 1.0);
  var uv = ndc * 0.5 + 0.5; uv.y = 1.0 - uv.y;
  o.uv = uv;
  return o;
}

fn hueRot(c: vec3f, deg: f32) -> vec3f {
  let a = deg * 0.017453292;
  let cs = cos(a); let sn = sin(a);
  return vec3f(
    c.r*(0.213+cs*0.787-sn*0.213) + c.g*(0.715-cs*0.715-sn*0.715) + c.b*(0.072-cs*0.072+sn*0.928),
    c.r*(0.213-cs*0.213+sn*0.143) + c.g*(0.715+cs*0.285+sn*0.140) + c.b*(0.072-cs*0.072-sn*0.283),
    c.r*(0.213-cs*0.213-sn*0.787) + c.g*(0.715-cs*0.715+sn*0.715) + c.b*(0.072+cs*0.928+sn*0.072),
  );
}

@fragment fn fs(in: VOut) -> @location(0) vec4f {
  let bg = select(vec3f(0.020, 0.020, 0.020), vec3f(0.929, 0.906, 0.871), uni.inverted != 0u);

  var src: vec4f;
  if (uni.dmtEnabled != 0u) {
    src = textureSample(dmtTex, samp, in.uv);
  } else {
    src = textureSample(glyphTex, samp, in.uv);
  }
  if (uni.hueDeg != 0.0) { src = vec4f(hueRot(src.rgb, uni.hueDeg), src.a); }

  var color = mix(bg, src.rgb, src.a);

  if (uni.glowStr > 0.0 && uni.inverted == 0u) {
    var bl = textureSample(bloomTex, samp, in.uv).rgb;
    if (uni.hueDeg != 0.0) { bl = hueRot(bl, uni.hueDeg); }
    color = clamp(color + bl * uni.glowStr, vec3f(0.0), vec3f(1.0));
  }

  if (uni.crtEnabled != 0u) {
    let t = fract((in.uv.y * uni.canvasH + uni.crtScrollY) / uni.crtPeriod);
    let scan = smoothstep(0.0, 0.3, t) * (1.0 - smoothstep(0.4, 0.7, t));
    color *= 1.0 - uni.crtOpacity * (1.0 - scan);
  }

  return vec4f(color, 1.0);
}
`;

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface RenderInput {
  cellData: Float32Array;
  cols: number;
  rows: number;
  charCount: number;
  cellW: number;
  cellH: number;
  gridOffX: number;
  gridOffY: number;
  W: number;
  H: number;
  effectiveGlow: number;
  psyHueDeg: number;
  inverted: boolean;
  dmtEnabled: boolean;
  dmtDx: number;
  dmtDy: number;
  dmtZoom: number;
  dmtSwirl: number;
  dmtPersistence: number;
  dmtBlurPx: number;
  crtEnabled: boolean;
  crtScrollY: number;
  crtOpacity: number;
  crtPeriod: number;
}

// ─── Renderer Class ───────────────────────────────────────────────────────────

export class WebGPUAsciiRenderer {
  private dev: GPUDevice;
  private ctx: GPUCanvasContext;
  private fmt: GPUTextureFormat;

  private samp!: GPUSampler;
  private glyphPipe!: GPURenderPipeline;
  private blurHPipe!: GPUComputePipeline;
  private blurVPipe!: GPUComputePipeline;
  private dmtPipe!: GPURenderPipeline;
  private compPipe!: GPURenderPipeline;

  // Per-size render targets (recreated on resize)
  private glyphTex!: GPUTexture;
  private bloomA!: GPUTexture;
  private bloomB!: GPUTexture;
  private dmtTex!: [GPUTexture, GPUTexture];
  private texW = 0;
  private texH = 0;

  // Persistent GPU buffers
  private cellBuf!: GPUBuffer;
  private cellBufSz = 0;
  private glyphUni!: GPUBuffer; // 48 bytes
  private blurBuf!: GPUBuffer;  // 16 bytes
  private dmtBuf!: GPUBuffer;   // 48 bytes
  private compBuf!: GPUBuffer;  // 48 bytes

  // Glyph atlas texture
  private atlasTex!: GPUTexture;
  private atlasKey = "";

  // Bind groups (rebuilt when resources change)
  private glyphBG!: GPUBindGroup;
  private blurHBG!: GPUBindGroup;
  private blurVBG!: GPUBindGroup;
  private dmtBGs!: [GPUBindGroup, GPUBindGroup];
  private compBGs!: [GPUBindGroup, GPUBindGroup];
  private bgsDirty = true;

  // DMT ping-pong index
  private dmtIdx = 0;

  constructor(dev: GPUDevice, ctx: GPUCanvasContext, fmt: GPUTextureFormat) {
    this.dev = dev;
    this.ctx = ctx;
    this.fmt = fmt;
    this.initPipelines();
    this.initBuffers();
  }

  private initPipelines() {
    const d = this.dev;

    this.samp = d.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge",
    });

    // Glyph render pipeline — no alpha blending (glyphs occupy non-overlapping cells)
    const glyphMod = d.createShaderModule({ code: GLYPH_WGSL });
    this.glyphPipe = d.createRenderPipeline({
      layout: "auto",
      vertex: { module: glyphMod, entryPoint: "vs" },
      fragment: { module: glyphMod, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
    });

    // Bloom compute pipelines
    this.blurHPipe = d.createComputePipeline({
      layout: "auto",
      compute: { module: d.createShaderModule({ code: BLUR_H_WGSL }), entryPoint: "main" },
    });
    this.blurVPipe = d.createComputePipeline({
      layout: "auto",
      compute: { module: d.createShaderModule({ code: BLUR_V_WGSL }), entryPoint: "main" },
    });

    // DMT warp render pipeline
    const dmtMod = d.createShaderModule({ code: DMT_WGSL });
    this.dmtPipe = d.createRenderPipeline({
      layout: "auto",
      vertex: { module: dmtMod, entryPoint: "vs" },
      fragment: { module: dmtMod, entryPoint: "fs", targets: [{ format: "rgba8unorm" }] },
      primitive: { topology: "triangle-list" },
    });

    // Final composite pipeline → canvas
    const compMod = d.createShaderModule({ code: COMPOSITE_WGSL });
    this.compPipe = d.createRenderPipeline({
      layout: "auto",
      vertex: { module: compMod, entryPoint: "vs" },
      fragment: { module: compMod, entryPoint: "fs", targets: [{ format: this.fmt }] },
      primitive: { topology: "triangle-list" },
    });
  }

  private initBuffers() {
    const d = this.dev;
    this.glyphUni = d.createBuffer({ size: 48, usage: BU.UNIFORM | BU.COPY_DST });
    this.blurBuf  = d.createBuffer({ size: 16, usage: BU.UNIFORM | BU.COPY_DST });
    this.dmtBuf   = d.createBuffer({ size: 48, usage: BU.UNIFORM | BU.COPY_DST });
    this.compBuf  = d.createBuffer({ size: 48, usage: BU.UNIFORM | BU.COPY_DST });
    this.cellBufSz = 4096;
    this.cellBuf   = d.createBuffer({ size: this.cellBufSz, usage: BU.STORAGE | BU.COPY_DST });
  }

  /** Synchronously build or update the glyph atlas texture. */
  buildAtlas(chars: string): void {
    if (chars === this.atlasKey && this.atlasTex) return;
    this.atlasKey = chars;

    const n       = chars.length;
    const atlasW  = n * GLYPH_W;
    const atlasH  = GLYPH_H;
    const fontSize = Math.round(GLYPH_H * 0.78);

    const oc  = new OffscreenCanvas(atlasW, atlasH);
    const octx = oc.getContext("2d")!;
    octx.clearRect(0, 0, atlasW, atlasH);
    octx.fillStyle = "white";
    octx.font = `${fontSize}px 'JetBrains Mono', monospace`;
    octx.textAlign = "center";
    octx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      octx.fillText(chars[i], i * GLYPH_W + GLYPH_W / 2, GLYPH_H / 2);
    }

    this.atlasTex?.destroy();
    this.atlasTex = this.dev.createTexture({
      size: [atlasW, atlasH],
      format: "rgba8unorm",
      usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.RENDER_ATTACHMENT,
    });
    this.dev.queue.copyExternalImageToTexture(
      { source: oc },
      { texture: this.atlasTex },
      [atlasW, atlasH],
    );
    this.bgsDirty = true;
  }

  private ensureTextures(w: number, h: number) {
    if (this.texW === w && this.texH === h) return;
    this.texW = w; this.texH = h;

    this.glyphTex?.destroy();
    this.bloomA?.destroy();
    this.bloomB?.destroy();
    this.dmtTex?.[0]?.destroy();
    this.dmtTex?.[1]?.destroy();

    const makeRA  = () => this.dev.createTexture({ size: [w, h], format: "rgba8unorm", usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    const makeST  = () => this.dev.createTexture({ size: [w, h], format: "rgba8unorm", usage: TU.STORAGE_BINDING   | TU.TEXTURE_BINDING });

    this.glyphTex = makeRA();
    this.bloomA   = makeST();
    this.bloomB   = makeST();
    this.dmtTex   = [makeRA(), makeRA()];

    // Clear DMT ping-pong textures so first frame starts clean
    const enc = this.dev.createCommandEncoder();
    for (const t of this.dmtTex) {
      const p = enc.beginRenderPass({
        colorAttachments: [{ view: t.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
      });
      p.end();
    }
    this.dev.queue.submit([enc.finish()]);

    this.bgsDirty = true;
  }

  private ensureCellBuffer(cellCount: number) {
    const needed = cellCount * 16; // 4 floats × 4 bytes
    if (this.cellBufSz >= needed) return;
    this.cellBuf.destroy();
    this.cellBufSz = Math.max(needed * 2, 4096);
    this.cellBuf = this.dev.createBuffer({ size: this.cellBufSz, usage: BU.STORAGE | BU.COPY_DST });
    this.bgsDirty = true;
  }

  private rebuildBGs() {
    if (!this.atlasTex) return;
    const d = this.dev;

    const gv  = this.glyphTex.createView();
    const baV = this.bloomA.createView();
    const bbV = this.bloomB.createView();

    // Glyph pass reads atlas, writes glyph cell data
    this.glyphBG = d.createBindGroup({
      layout: this.glyphPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.glyphUni } },
        { binding: 1, resource: { buffer: this.cellBuf } },
        { binding: 2, resource: this.atlasTex.createView() },
        { binding: 3, resource: this.samp },
      ],
    });

    // Bloom H: reads glyphTex (texture_2d) → writes bloomA (storage)
    this.blurHBG = d.createBindGroup({
      layout: this.blurHPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: gv },
        { binding: 1, resource: baV },
        { binding: 2, resource: { buffer: this.blurBuf } },
      ],
    });

    // Bloom V: reads bloomA (texture_2d) → writes bloomB (storage)
    this.blurVBG = d.createBindGroup({
      layout: this.blurVPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: baV },
        { binding: 1, resource: bbV },
        { binding: 2, resource: { buffer: this.blurBuf } },
      ],
    });

    // DMT BG[i] reads from dmtTex[i]; render pass writes to dmtTex[1-i]
    this.dmtBGs = [
      d.createBindGroup({
        layout: this.dmtPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.dmtTex[0].createView() },
          { binding: 1, resource: gv },
          { binding: 2, resource: this.samp },
          { binding: 3, resource: { buffer: this.dmtBuf } },
        ],
      }),
      d.createBindGroup({
        layout: this.dmtPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.dmtTex[1].createView() },
          { binding: 1, resource: gv },
          { binding: 2, resource: this.samp },
          { binding: 3, resource: { buffer: this.dmtBuf } },
        ],
      }),
    ];

    // Composite BG[i] reads dmtTex[1-i] (the result written when dmtBGs[i] is used)
    this.compBGs = [
      d.createBindGroup({
        layout: this.compPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.compBuf } },
          { binding: 1, resource: gv },
          { binding: 2, resource: this.dmtTex[1].createView() },
          { binding: 3, resource: bbV },
          { binding: 4, resource: this.samp },
        ],
      }),
      d.createBindGroup({
        layout: this.compPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.compBuf } },
          { binding: 1, resource: gv },
          { binding: 2, resource: this.dmtTex[0].createView() },
          { binding: 3, resource: bbV },
          { binding: 4, resource: this.samp },
        ],
      }),
    ];

    this.bgsDirty = false;
  }

  render(inp: RenderInput): void {
    const {
      cellData, cols, rows, charCount, cellW, cellH, gridOffX, gridOffY, W, H,
      effectiveGlow, psyHueDeg, inverted,
      dmtEnabled, dmtDx, dmtDy, dmtZoom, dmtSwirl, dmtPersistence, dmtBlurPx,
      crtEnabled, crtScrollY, crtOpacity, crtPeriod,
    } = inp;

    const d = this.dev;

    this.ensureTextures(W, H);
    this.ensureCellBuffer(cols * rows);
    if (!this.atlasTex) return;
    if (this.bgsDirty) this.rebuildBGs();

    // ── Upload cell data ──────────────────────────────────────────────────────
    d.queue.writeBuffer(this.cellBuf, 0, cellData, 0, cols * rows * 4);

    // ── Glyph uniforms ────────────────────────────────────────────────────────
    {
      const ab  = new ArrayBuffer(48);
      const f32 = new Float32Array(ab);
      const u32 = new Uint32Array(ab);
      f32[0] = W; f32[1] = H; f32[2] = gridOffX; f32[3] = gridOffY;
      f32[4] = cellW; f32[5] = cellH;
      u32[6] = cols; u32[7] = rows;
      f32[8] = charCount;
      d.queue.writeBuffer(this.glyphUni, 0, ab);
    }

    // ── Bloom params ──────────────────────────────────────────────────────────
    const glowStr = Math.min(1, effectiveGlow * 0.9);
    if (glowStr > 0.01) {
      const blurStep = Math.max(1, Math.round(cellH * effectiveGlow * 0.8));
      const ab  = new ArrayBuffer(16);
      const f32 = new Float32Array(ab);
      const u32 = new Uint32Array(ab);
      u32[0] = W; u32[1] = H;
      f32[2] = blurStep;
      d.queue.writeBuffer(this.blurBuf, 0, ab);
    }

    // ── DMT params ────────────────────────────────────────────────────────────
    if (dmtEnabled) {
      const f32 = new Float32Array(12);
      f32[0] = W; f32[1] = H; f32[2] = dmtDx; f32[3] = dmtDy;
      f32[4] = dmtZoom; f32[5] = dmtSwirl; f32[6] = dmtPersistence; f32[7] = dmtBlurPx;
      f32[8] = psyHueDeg;
      d.queue.writeBuffer(this.dmtBuf, 0, f32);
    }

    // ── Composite params ──────────────────────────────────────────────────────
    {
      const ab  = new ArrayBuffer(48);
      const f32 = new Float32Array(ab);
      const u32 = new Uint32Array(ab);
      f32[0] = W; f32[1] = H; f32[2] = glowStr; f32[3] = psyHueDeg;
      u32[4] = inverted   ? 1 : 0;
      u32[5] = dmtEnabled ? 1 : 0;
      u32[6] = crtEnabled ? 1 : 0;
      f32[7] = crtScrollY; f32[8] = crtPeriod; f32[9] = crtOpacity;
      d.queue.writeBuffer(this.compBuf, 0, ab);
    }

    // ── Encode GPU commands ───────────────────────────────────────────────────
    const enc = d.createCommandEncoder();

    // Pass 1: Render glyph instances → glyphTex
    {
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: this.glyphTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
      });
      pass.setPipeline(this.glyphPipe);
      pass.setBindGroup(0, this.glyphBG);
      pass.draw(6, cols * rows); // 6 verts/quad × N instances
      pass.end();
    }

    // Pass 2 & 3: Bloom — H-blur then V-blur (compute)
    if (glowStr > 0.01 && !inverted) {
      const wgX = Math.ceil(W / 8);
      const wgY = Math.ceil(H / 8);
      const hPass = enc.beginComputePass();
      hPass.setPipeline(this.blurHPipe);
      hPass.setBindGroup(0, this.blurHBG);
      hPass.dispatchWorkgroups(wgX, wgY);
      hPass.end();
      const vPass = enc.beginComputePass();
      vPass.setPipeline(this.blurVPipe);
      vPass.setBindGroup(0, this.blurVBG);
      vPass.dispatchWorkgroups(wgX, wgY);
      vPass.end();
    }

    // Pass 4: DMT warp (ping-pong)
    let compIdx = this.dmtIdx;
    if (dmtEnabled) {
      const writeTex = this.dmtTex[1 - this.dmtIdx];
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: writeTex.createView(), clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: "clear", storeOp: "store" }],
      });
      pass.setPipeline(this.dmtPipe);
      pass.setBindGroup(0, this.dmtBGs[this.dmtIdx]);
      pass.draw(3);
      pass.end();
      compIdx = this.dmtIdx;
      this.dmtIdx ^= 1; // flip for next frame
    }

    // Pass 5: Composite → canvas
    {
      const canvasView = this.ctx.getCurrentTexture().createView();
      const pass = enc.beginRenderPass({
        colorAttachments: [{ view: canvasView, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" }],
      });
      pass.setPipeline(this.compPipe);
      pass.setBindGroup(0, this.compBGs[compIdx]);
      pass.draw(3);
      pass.end();
    }

    d.queue.submit([enc.finish()]);
  }

  dispose(): void {
    this.glyphTex?.destroy();
    this.bloomA?.destroy();
    this.bloomB?.destroy();
    this.dmtTex?.[0]?.destroy();
    this.dmtTex?.[1]?.destroy();
    this.atlasTex?.destroy();
    this.cellBuf?.destroy();
    this.glyphUni?.destroy();
    this.blurBuf?.destroy();
    this.dmtBuf?.destroy();
    this.compBuf?.destroy();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export async function tryCreateWebGPURenderer(canvas: HTMLCanvasElement): Promise<WebGPUAsciiRenderer | null> {
  if (!navigator.gpu) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const ctx    = canvas.getContext("webgpu") as GPUCanvasContext | null;
    if (!ctx) return null;
    const fmt = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format: fmt, alphaMode: "opaque" });
    return new WebGPUAsciiRenderer(device, ctx, fmt);
  } catch (err) {
    console.warn("[WebGPU] init failed, falling back to Canvas 2D:", err);
    return null;
  }
}
