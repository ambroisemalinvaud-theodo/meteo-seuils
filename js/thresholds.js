// Logique pure (aucun accès au DOM ni au réseau) : facile à tester.
import { dayToIso, isoToDay } from './dates.js';

/** Liste des seuils, de `min` à `max` par pas de `step`. */
export function thresholdList(step, min = -10, max = 42) {
  const out = [];
  for (let t = min; t <= max; t += step) out.push(t);
  return out;
}

/** direction : 'ge' = atteint ou dépasse (≥), 'le' = atteint ou descend sous (≤) */
export function reaches(value, threshold, direction) {
  if (value == null || Number.isNaN(value)) return false;
  return direction === 'le' ? value <= threshold : value >= threshold;
}

/**
 * Pour chaque seuil : dernière date atteinte, jours écoulés, nombre de jours
 * sur les 365 derniers jours, moyenne de jours par an sur toute la période.
 * `refIso` = jour de référence (par défaut : dernier jour de la série).
 */
export function computeThresholds(series, opts = {}) {
  const { measure = 'tx', direction = 'ge', step = 1, min = -10, max = 42, refIso } = opts;
  const values = measure === 'tn' ? series.tn : series.tx;
  const n = values.length;
  const startDay = isoToDay(series.start);
  const refIndex = refIso ? isoToDay(refIso) - startDay : n - 1;
  const lastIndex = Math.min(refIndex, n - 1);

  let valid = 0;
  for (let i = 0; i <= lastIndex; i++) {
    const v = values[i];
    if (v != null && !Number.isNaN(v)) valid++;
  }
  const years = valid / 365.25;

  return thresholdList(step, min, max).map((threshold) => {
    let last = -1;
    let total = 0;
    let count365 = 0;
    for (let i = 0; i <= lastIndex; i++) {
      if (!reaches(values[i], threshold, direction)) continue;
      total++;
      last = i;
      if (i > refIndex - 365) count365++;
    }
    return {
      threshold,
      lastIso: last >= 0 ? dayToIso(startDay + last) : null,
      daysAgo: last >= 0 ? refIndex - last : null,
      count365,
      avgPerYear: years > 0 ? total / years : null,
    };
  });
}
