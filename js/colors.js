// Échelle de couleurs des températures (°C -> RGB) : bleu froid -> rouge chaud.
const STOPS = [
  [-10, [59, 76, 192]], [0, [124, 159, 249]], [10, [198, 218, 245]], [16, [245, 235, 190]],
  [22, [250, 190, 120]], [30, [235, 110, 70]], [38, [190, 40, 40]], [45, [120, 10, 40]],
];

/** Couleur [r, g, b] d'une température. */
export function tempRgb(v) {
  if (v <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (v <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const f = (v - t0) / (t1 - t0);
      return c0.map((x, k) => Math.round(x + (c1[k] - x) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export const rgbCss = (c) => `rgb(${c.join(',')})`;
export const tempColor = (v) => rgbCss(tempRgb(v));

/** Texte noir ou blanc, selon la luminosité du fond. */
export function textOn(c) {
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.62 ? '#10151c' : '#ffffff';
}

export function legendGradient() {
  const [a, b] = [-10, 40];
  const pts = STOPS.filter(([t]) => t >= a && t <= b).map(([t]) => `${tempColor(t)} ${((t - a) / (b - a)) * 100}%`);
  return `linear-gradient(90deg, ${tempColor(a)} 0%, ${pts.join(', ')}, ${tempColor(b)} 100%)`;
}
