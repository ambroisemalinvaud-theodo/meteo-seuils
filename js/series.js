// Une "série" = les températures quotidiennes d'une ville :
// { start: '1940-01-01', tx: [...], tn: [...], archiveEnd: 'AAAA-MM-JJ' }
// tx[i] / tn[i] = valeur du jour (start + i jours), ou null si inconnue.
import { addDays, dayToIso, isoToDay } from './dates.js';

export function emptySeries(start) {
  return { start, tx: [], tn: [], tm: [], archiveEnd: null };
}

/** Série de valeurs pour une mesure : 'tx' = max, 'tn' = min, 'tm' = moyenne. */
export function seriesFor(series, measure) {
  return (measure === 'tn' ? series.tn : measure === 'tm' ? series.tm : series.tx) || [];
}

export function lastIso(series) {
  return series.tx.length ? addDays(series.start, series.tx.length - 1) : null;
}

export function valueAt(series, iso, measure) {
  const i = isoToDay(iso) - isoToDay(series.start);
  const v = seriesFor(series, measure)[i];
  return v == null || Number.isNaN(v) ? null : v;
}

/**
 * Insère les jours renvoyés par l'API (daily.time / temperature_2m_max / _min).
 * canWrite(iso, ancienneValeurTx) permet de décider jour par jour si on écrase.
 * Retourne la dernière date contenant une valeur Tx non nulle dans `daily`.
 */
export function mergeDaily(series, daily, canWrite = () => true) {
  const startDay = isoToDay(series.start);
  series.tm ||= [];
  let lastWithData = null;
  daily.time.forEach((iso, k) => {
    const mx = daily.temperature_2m_max[k];
    const mn = daily.temperature_2m_min[k];
    const mm = daily.temperature_2m_mean?.[k] ?? null;
    if (mx == null && mn == null && mm == null) return;
    const i = isoToDay(iso) - startDay;
    if (i < 0) return;
    if (mx != null) lastWithData = iso;
    if (!canWrite(iso, series.tx[i])) return;
    while (series.tx.length <= i) { series.tx.push(null); series.tn.push(null); }
    while (series.tm.length < series.tx.length) series.tm.push(null);
    if (mx != null) series.tx[i] = mx;
    if (mn != null) series.tn[i] = mn;
    if (mm != null) series.tm[i] = mm;
  });
  return lastWithData;
}

export { dayToIso };
