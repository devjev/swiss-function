/** Time-series downsampling for zoomable charts. Pure — no React, no DOM. */

/** Index range [start, end) of the points whose x falls in [x0, x1], widened
 *  by one point on each side so connecting line segments extend past the plot
 *  edges. Requires data sorted ascending by x. Binary search — O(log n). */
export function sliceRange<T>(
  data: readonly T[],
  getX: (d: T) => number,
  x0: number,
  x1: number,
): [number, number] {
  const n = data.length;
  if (n === 0) return [0, 0];
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (getX(data[mid] as T) < x0) lo = mid + 1;
    else hi = mid;
  }
  const lower = lo;
  lo = 0;
  hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (getX(data[mid] as T) <= x1) lo = mid + 1;
    else hi = mid;
  }
  return [Math.max(0, lower - 1), Math.min(n, lo + 1)];
}

/** M4 decimation (Jugel et al., VLDB 2014): bucket the series into `buckets`
 *  equal x-width bins and keep each bin's first, min-y, max-y, and last point
 *  (deduplicated, in x order). With buckets ≈ plot-width pixel columns the
 *  polyline renders pixel-identically to the full series while bounding the
 *  element count. Returns the input array itself when it's already small
 *  enough (≤ 4 × buckets). Requires data sorted ascending by x. */
export function minMaxDownsample<T>(
  data: readonly T[],
  getX: (d: T) => number,
  getY: (d: T) => number,
  buckets: number,
): readonly T[] {
  const n = data.length;
  if (buckets <= 0 || n <= buckets * 4) return data;
  const xFirst = getX(data[0] as T);
  const span = getX(data[n - 1] as T) - xFirst;
  if (span <= 0) return data;
  const invWidth = buckets / span;
  const out: T[] = [];
  let bin = 0;
  let firstIdx = 0;
  let lastIdx = 0;
  let minIdx = 0;
  let maxIdx = 0;
  let minY = getY(data[0] as T);
  let maxY = minY;
  const flush = () => {
    out.push(data[firstIdx] as T);
    let prev = firstIdx;
    const idxLo = Math.min(minIdx, maxIdx);
    const idxHi = Math.max(minIdx, maxIdx);
    if (idxLo > prev) {
      out.push(data[idxLo] as T);
      prev = idxLo;
    }
    if (idxHi > prev) {
      out.push(data[idxHi] as T);
      prev = idxHi;
    }
    if (lastIdx > prev) out.push(data[lastIdx] as T);
  };
  for (let i = 1; i < n; i++) {
    const p = data[i] as T;
    const b = Math.min(buckets - 1, Math.floor((getX(p) - xFirst) * invWidth));
    if (b !== bin) {
      flush();
      bin = b;
      firstIdx = i;
      minIdx = i;
      maxIdx = i;
      minY = getY(p);
      maxY = minY;
    } else {
      const y = getY(p);
      if (y < minY) {
        minY = y;
        minIdx = i;
      }
      if (y > maxY) {
        maxY = y;
        maxIdx = i;
      }
    }
    lastIdx = i;
  }
  flush();
  return out;
}

/** LTTB — largest-triangle-three-buckets (Steinarsson 2013). Picks the point
 *  per bucket forming the largest triangle with the previous pick and the
 *  next bucket's average. Better shape preservation than min/max for smooth
 *  series, but may clip extreme spikes. Returns the input array itself when
 *  data.length <= target. First and last points are always kept. */
export function lttb<T>(
  data: readonly T[],
  getX: (d: T) => number,
  getY: (d: T) => number,
  target: number,
): readonly T[] {
  const n = data.length;
  if (n <= target) return data;
  if (target < 3) return n < 2 ? data : [data[0] as T, data[n - 1] as T];
  const out: T[] = [data[0] as T];
  const every = (n - 2) / (target - 2);
  let a = 0;
  for (let i = 0; i < target - 2; i++) {
    const avgStart = Math.floor((i + 1) * every) + 1;
    const avgEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    let avgX = 0;
    let avgY = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgX += getX(data[j] as T);
      avgY += getY(data[j] as T);
    }
    const avgCount = avgEnd - avgStart;
    avgX /= avgCount;
    avgY /= avgCount;
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const ax = getX(data[a] as T);
    const ay = getY(data[a] as T);
    let maxArea = -1;
    let next = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const p = data[j] as T;
      const area = Math.abs((ax - avgX) * (getY(p) - ay) - (ax - getX(p)) * (ay - avgY));
      if (area > maxArea) {
        maxArea = area;
        next = j;
      }
    }
    out.push(data[next] as T);
    a = next;
  }
  out.push(data[n - 1] as T);
  return out;
}
