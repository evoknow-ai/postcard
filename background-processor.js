/**
 * BackgroundProcessor v2 — real-time webcam background effects for PostCard.
 *
 * v2 fixes over v1:
 *  1. Halo/glow around head:   smoothstep mask thresholding (no more gamma haze)
 *  2. Color bleed into blur:   person is removed (dilated mask) + hole filled
 *                              via pull-push mips BEFORE the background is blurred
 *  3. Edge ring / bg chunks:   person cutout uses an ERODED mask so no
 *                              background-colored fringe pixels are included
 *  4. Mask flicker:            light temporal EMA across frames
 *
 * Same public API as v1. See README for MV3 asset bundling.
 */

import { ImageSegmenter, FilesetResolver } from './vendor/mediapipe/vision_bundle.mjs';

export class BackgroundProcessor {
  constructor({ video, canvas, wasmBasePath, modelPath }) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.wasmBasePath = wasmBasePath;
    this.modelPath = modelPath;

    this.mode = 'none';          // 'none' | 'blur' | 'color' | 'image'
    this.blurAmount = 14;        // px. Cap the UI at ~24; beyond that looks fake.
    this.edgeFeather = 1;        // px feather on the person cutout edge
    this.temporalSmoothing = 0.08;// weight of PREVIOUS mask (0 = off, <=0.5 rec.)
    this.bgColor = '#1f2937';
    this.bgImage = null;

    this.segmenter = null;
    this.running = false;
    this._rafId = null;
    this._lastVideoTime = -1;
    this._ema = null;            // Float32Array, temporal mask state
    this._tmpA = null;
    this._tmpB = null;

    // Person mask (eroded, tight) — used to cut out the person.
    this._personMaskCanvas = document.createElement('canvas');
    this._personMaskCtx = this._personMaskCanvas.getContext('2d');
    // Removal mask (dilated, generous) — used to erase the person from the
    // background layer before blurring, so their colors can't bleed.
    this._bgMaskCanvas = document.createElement('canvas');
    this._bgMaskCtx = this._bgMaskCanvas.getContext('2d');

    this._personCanvas = document.createElement('canvas');
    this._personCtx = this._personCanvas.getContext('2d');
    this._bgCanvas = document.createElement('canvas');
    this._bgCtx = this._bgCanvas.getContext('2d');
    this._bgOnlyCanvas = document.createElement('canvas');
    this._bgOnlyCtx = this._bgOnlyCanvas.getContext('2d');
    this._mips = [];             // pull-push pyramid canvases
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(this.wasmBasePath);
    this.segmenter = await ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: this.modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  }

  setMode(mode) { this.mode = mode; }
  setBlurAmount(px) { this.blurAmount = Math.min(px, 24); }
  setColor(hex) { this.bgColor = hex; }

  async setImage(src) {
    if (src instanceof HTMLImageElement || src instanceof ImageBitmap) { this.bgImage = src; return; }
    if (src instanceof Blob) { this.bgImage = await createImageBitmap(src); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    this.bgImage = img;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._renderFrame();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() { this.running = false; if (this._rafId) cancelAnimationFrame(this._rafId); }
  destroy() { this.stop(); this.segmenter?.close(); this.segmenter = null; }

  _syncSizes() {
    const w = this.video.videoWidth, h = this.video.videoHeight;
    if (!w || !h) return false;
    for (const c of [this.canvas, this._personCanvas, this._bgCanvas, this._bgOnlyCanvas]) {
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
    }
    // Pull-push pyramid: w/2, w/4, w/8, w/16
    if (this._mips.length === 0 || this._mips[0].width !== Math.ceil(w / 2)) {
      this._mips = [];
      for (let k = 1; k <= 4; k++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w / 2 ** k));
        c.height = Math.max(1, Math.ceil(h / 2 ** k));
        this._mips.push(c);
      }
    }
    return true;
  }

  _renderFrame() {
    if (!this._syncSizes()) return;
    const { video, ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;

    if (this.mode === 'none' || !this.segmenter) {
      ctx.drawImage(video, 0, 0, w, h);
      return;
    }

    if (video.currentTime !== this._lastVideoTime) {
      this._lastVideoTime = video.currentTime;
      const result = this.segmenter.segmentForVideo(video, performance.now());
      this._updateMasks(result);
      result.close();
    }

    this._drawBackground(w, h);

    // Person cutout with the TIGHT (eroded) mask + small feather.
    const pctx = this._personCtx;
    pctx.clearRect(0, 0, w, h);
    pctx.drawImage(video, 0, 0, w, h);
    pctx.globalCompositeOperation = 'destination-in';
    pctx.filter = `blur(${this.edgeFeather}px)`;
    pctx.drawImage(this._personMaskCanvas, 0, 0, w, h);
    pctx.filter = 'none';
    pctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(this._bgCanvas, 0, 0, w, h);
    ctx.drawImage(this._personCanvas, 0, 0, w, h);
  }

  // ---------------------------------------------------------------- masks --

  _updateMasks(result) {
    const masks = result.confidenceMasks || [];
    if (!masks.length) return;

    // Multiclass selfie model:
    // 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 accessories.
    // Build a class-aware foreground confidence map. Skin is boosted slightly
    // so the jaw/chin/neck are not cut away and replaced by dark background,
    // which was creating the fake "beard" artifact.
    const first = masks[0];
    const mw = first.width, mh = first.height;
    const n = mw * mh;
    const cur = new Float32Array(n);

    if (masks.length >= 6) {
      const hair = masks[1].getAsFloat32Array();
      const bodySkin = masks[2].getAsFloat32Array();
      const faceSkin = masks[3].getAsFloat32Array();
      const clothes = masks[4].getAsFloat32Array();
      const accessories = masks[5].getAsFloat32Array();

      for (let i = 0; i < n; i++) {
        const v = Math.max(
          hair[i] * 1.06,
          bodySkin[i] * 1.22,
          faceSkin[i] * 1.28,
          clothes[i] * 1.02,
          accessories[i] * 1.06
        );
        cur[i] = v > 1 ? 1 : v;
      }
    } else {
      const bg = first.getAsFloat32Array();
      for (let i = 0; i < n; i++) cur[i] = 1 - bg[i];
    }

    // Very light temporal smoothing so fast facial/jaw movement does not trail.
    if (this._ema && this._ema.length === n && this.temporalSmoothing > 0) {
      const a = this.temporalSmoothing;
      for (let i = 0; i < n; i++) {
        this._ema[i] = this._ema[i] * a + cur[i] * (1 - a);
      }
    } else {
      this._ema = Float32Array.from(cur);
    }

    if (!this._tmpA || this._tmpA.length !== n) {
      this._tmpA = new Float32Array(n);
      this._tmpB = new Float32Array(n);
    }

    // IMPORTANT: Do not erode the visible person mask. Erosion was shaving
    // off jaw/neck pixels and letting the dark background show through.
    this._tmpA.set(this._ema);
    this._writeMask(
      this._personMaskCanvas,
      this._personMaskCtx,
      this._tmpA,
      mw, mh,
      0.22, 0.62
    );

    // Background-removal mask remains generous so blur never samples person color.
    this._morph(this._ema, this._tmpB, mw, mh, 2, true);
    this._writeMask(
      this._bgMaskCanvas,
      this._bgMaskCtx,
      this._tmpB,
      mw, mh,
      0.08, 0.38
    );
  }

  /** Separable min (erode) / max (dilate) filter, radius r, src -> dst. */
  _morph(src, dst, w, h, r, dilate) {
    const tmp = (this._morphTmp ||= new Float32Array(src.length));
    // horizontal
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = dilate ? 0 : 1;
        const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
        for (let k = x0; k <= x1; k++) {
          const s = src[row + k];
          v = dilate ? (s > v ? s : v) : (s < v ? s : v);
        }
        tmp[row + x] = v;
      }
    }
    // vertical
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let v = dilate ? 0 : 1;
        const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
        for (let k = y0; k <= y1; k++) {
          const s = tmp[k * w + x];
          v = dilate ? (s > v ? s : v) : (s < v ? s : v);
        }
        dst[y * w + x] = v;
      }
    }
  }

  _writeMask(canvasEl, cctx, data, mw, mh, lo, hi) {
    if (canvasEl.width !== mw || canvasEl.height !== mh) {
      canvasEl.width = mw; canvasEl.height = mh;
    }
    const imageData = cctx.createImageData(mw, mh);
    const px = imageData.data;
    const inv = 1 / (hi - lo);
    for (let i = 0; i < data.length; i++) {
      let t = (data[i] - lo) * inv;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const a = (t * t * (3 - 2 * t)) * 255; // smoothstep
      const o = i * 4;
      px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = a;
    }
    cctx.putImageData(imageData, 0, 0);
  }

  // ----------------------------------------------------------- background --

  _drawBackground(w, h) {
    const bctx = this._bgCtx;
    bctx.filter = 'none';

    if (this.mode === 'color') {
      bctx.fillStyle = this.bgColor;
      bctx.fillRect(0, 0, w, h);
      return;
    }

    if (this.mode === 'image' && this.bgImage) {
      const iw = this.bgImage.width, ih = this.bgImage.height;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      bctx.drawImage(this.bgImage, (w - dw) / 2, (h - dh) / 2, dw, dh);
      return;
    }

    if (this.mode === 'blur') {
      // 1. Background-only layer: video with the person ERASED (dilated mask,
      //    slightly feathered) — leaves a transparent hole.
      const octx = this._bgOnlyCtx;
      octx.clearRect(0, 0, w, h);
      octx.drawImage(this.video, 0, 0, w, h);
      octx.globalCompositeOperation = 'destination-out';
      octx.filter = 'blur(2px)';
      octx.drawImage(this._bgMaskCanvas, 0, 0, w, h);
      octx.filter = 'none';
      octx.globalCompositeOperation = 'source-over';

      // 2. Pull-push hole fill: downsample the holed image, then composite
      //    coarser levels UNDER finer ones. The hole inherits the average of
      //    surrounding background colors — the person's colors never enter
      //    the blur, so no green/skin halo.
      let prev = this._bgOnlyCanvas;
      for (const mip of this._mips) {
        const mctx = mip.getContext('2d');
        mctx.clearRect(0, 0, mip.width, mip.height);
        mctx.drawImage(prev, 0, 0, mip.width, mip.height);
        prev = mip;
      }
      for (let k = this._mips.length - 2; k >= 0; k--) {
        const mctx = this._mips[k].getContext('2d');
        mctx.globalCompositeOperation = 'destination-over';
        mctx.drawImage(this._mips[k + 1], 0, 0, this._mips[k].width, this._mips[k].height);
        mctx.globalCompositeOperation = 'source-over';
      }
      octx.globalCompositeOperation = 'destination-over';
      octx.drawImage(this._mips[0], 0, 0, w, h);
      octx.globalCompositeOperation = 'source-over';

      // 3. Blur the person-free background. Overdraw past the edges so the
      //    blur never samples outside the frame (prevents dark vignette).
      const pad = this.blurAmount * 2;
      bctx.filter = `blur(${this.blurAmount}px)`;
      bctx.drawImage(this._bgOnlyCanvas, -pad, -pad, w + pad * 2, h + pad * 2);
      bctx.filter = 'none';
      return;
    }

    bctx.fillStyle = '#111827';
    bctx.fillRect(0, 0, w, h);
  }
}
