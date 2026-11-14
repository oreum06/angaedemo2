// TEMPORARY sprite extraction from official character sheets.
// The sheets are not production sprites (VISUAL_DIRECTION §4.3). This removes the
// flat paper background around ONE turnaround figure so the scene can be staged
// with the official design until real transparent portraits are supplied.
// Output is always flagged temp:true by the manifest.

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('missing image: ' + src));
    img.src = src;
  });
}

const dist = (d, i, c) => {
  const r = d[i] - c[0], g = d[i + 1] - c[1], b = d[i + 2] - c[2];
  return Math.sqrt(r * r + g * g + b * b);
};

/**
 * @param {HTMLImageElement} sheet
 * @param {{rect:number[], scale?:number, flood?:number, soft?:number, hole?:number}} opt
 * @returns {HTMLCanvasElement}
 */
export function extractFigure(sheet, opt) {
  const [sx, sy, w, h] = opt.rect;
  const flood = opt.flood ?? 24;   // bg similarity for flood from border
  const soft = opt.soft ?? 70;     // distance at which an edge pixel is fully opaque
  const hole = opt.hole ?? 9;      // enclosed bg-like regions stricter threshold
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(sheet, sx, sy, w, h, 0, 0, w, h);
  const im = x.getImageData(0, 0, w, h);
  const d = im.data;
  const N = w * h;

  // background colour = median of border pixels
  const border = [];
  for (let i = 0; i < w; i++) { border.push(i, (h - 1) * w + i); }
  for (let j = 0; j < h; j++) { border.push(j * w, j * w + w - 1); }
  const ch = k => border.map(p => d[p * 4 + k]).sort((a, b) => a - b)[border.length >> 1];
  const bg = [ch(0), ch(1), ch(2)];

  // 1. flood fill background from border
  const isBg = new Uint8Array(N);
  const q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (const p of border) if (!isBg[p] && dist(d, p * 4, bg) < flood) { isBg[p] = 1; q[qt++] = p; }
  while (qh < qt) {
    const p = q[qh++], px = p % w, py = (p / w) | 0;
    const nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1];
    for (const n of nb) if (n >= 0 && !isBg[n] && dist(d, n * 4, bg) < flood) { isBg[n] = 1; q[qt++] = n; }
  }

  // 2. keep the largest foreground component (drops neighbouring figures cut by the rect)
  const lab = new Int32Array(N).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  for (let s = 0; s < N; s++) {
    if (isBg[s] || lab[s] >= 0) continue;
    qh = 0; qt = 0; q[qt++] = s; lab[s] = id; let size = 0;
    while (qh < qt) {
      const p = q[qh++]; size++;
      const px = p % w, py = (p / w) | 0;
      const nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1];
      for (const n of nb) if (n >= 0 && !isBg[n] && lab[n] < 0) { lab[n] = id; q[qt++] = n; }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  for (let p = 0; p < N; p++) if (!isBg[p] && lab[p] !== best) isBg[p] = 1;

  // 3. enclosed paper gaps (e.g. between arm and body): strict colour match, min area
  const seen = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (isBg[s] || seen[s] || dist(d, s * 4, bg) >= hole) continue;
    qh = 0; qt = 0; q[qt++] = s; seen[s] = 1;
    while (qh < qt) {
      const p = q[qh++], px = p % w, py = (p / w) | 0;
      const nb = [px > 0 ? p - 1 : -1, px < w - 1 ? p + 1 : -1, py > 0 ? p - w : -1, py < h - 1 ? p + w : -1];
      for (const n of nb) if (n >= 0 && !isBg[n] && !seen[n] && dist(d, n * 4, bg) < hole) { seen[n] = 1; q[qt++] = n; }
    }
    if (qt >= (opt.holeMin ?? 60)) for (let k = 0; k < qt; k++) isBg[q[k]] = 1;
  }

  // 4. alpha + soft edge with colour decontamination
  for (let p = 0; p < N; p++) {
    const i = p * 4;
    if (isBg[p]) { d[i + 3] = 0; continue; }
    const px = p % w, py = (p / w) | 0;
    const edge = (px > 0 && isBg[p - 1]) || (px < w - 1 && isBg[p + 1]) || (py > 0 && isBg[p - w]) || (py < h - 1 && isBg[p + w]);
    if (!edge) continue;
    const a = Math.max(0.15, Math.min(1, (dist(d, i, bg) - flood * 0.5) / (soft - flood * 0.5)));
    for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, (d[i + k] - (1 - a) * bg[k]) / a));
    d[i + 3] = Math.round(a * 255);
  }
  x.putImageData(im, 0, 0);

  // 5. upscale (temp only — sheet figures are ~400–600 px tall)
  const s = opt.scale ?? 2;
  let src = c, cw = w, chh = h;
  // two-step upscale gives a cleaner result than one large jump
  while (cw * 2 <= w * s) {
    const n = document.createElement('canvas');
    n.width = cw * 2; n.height = chh * 2;
    const nx = n.getContext('2d');
    nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = 'high';
    nx.drawImage(src, 0, 0, n.width, n.height);
    src = n; cw = n.width; chh = n.height;
  }
  return src;
}
