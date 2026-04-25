/**
 * Bemonster luminantie binnen een ellips (gezicht in ovaal) en spreiding (contrast).
 * Geen echte ML, wel bruikbaar genoeg voor "genoeg licht" + iets in beeld.
 */
export function sampleOvalLuma(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): { avg: number; spread: number; n: number } {
  const { data } = ctx.getImageData(0, 0, w, h)
  let sum = 0
  let n = 0
  let sumsq = 0
  const cx = w / 2
  const cy = h * 0.4
  const rx = w * 0.36
  const ry = h * 0.4
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      const i = (y * w + x) * 4
      const l =
        0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      sum += l
      sumsq += l * l
      n++
    }
  }
  if (n < 4) return { avg: 0, spread: 0, n: 0 }
  const avg = sum / n
  const varp = sumsq / n - avg * avg
  return { avg, spread: Math.sqrt(Math.max(0, varp)), n }
}
