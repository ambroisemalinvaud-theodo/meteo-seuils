// Logique des "questions rapides" (sans DOM, testable).
import { isoToDay, dayToIso, formatLong } from './dates.js';
import { reaches } from './thresholds.js';
import { lastIso } from './series.js';

/**
 * period : 'all' (tout l'historique) | '365' | '30' (derniers jours) | 'cy' (année du dernier jour de données) | 'y:2025'
 * Retourne la dernière date atteinte, les jours écoulés, et le nombre de jours atteints sur la période.
 */
export function answerQuestion(series, { measure, direction, threshold, period }, refIso = lastIso(series)) {
  const values = measure === 'tn' ? series.tn : series.tx;
  const startDay = isoToDay(series.start);
  const refIdx = isoToDay(refIso) - startDay;
  const top = Math.min(refIdx, values.length - 1);

  let last = -1;
  for (let i = top; i >= 0; i--) {
    if (reaches(values[i], threshold, direction)) { last = i; break; }
  }

  let year = null;
  let a = 0;
  let b = refIdx;
  if (period === '365') a = refIdx - 364;
  else if (period === '30') a = refIdx - 29;
  else if (period === 'cy' || period?.startsWith('y:')) {
    year = period === 'cy' ? Number(refIso.slice(0, 4)) : Number(period.slice(2));
    a = isoToDay(`${year}-01-01`) - startDay;
    b = Math.min(refIdx, isoToDay(`${year}-12-31`) - startDay);
  }
  a = Math.max(a, 0);

  let count = 0;
  let valid = 0;
  for (let i = a; i <= Math.min(b, top); i++) {
    const v = values[i];
    if (v != null && !Number.isNaN(v)) valid++;
    if (reaches(v, threshold, direction)) count++;
  }
  return {
    lastIso: last >= 0 ? dayToIso(startDay + last) : null,
    daysAgo: last >= 0 ? refIdx - last : null,
    count,
    validDays: valid,
    elapsedDays: Math.max(0, b - a + 1),
    year,
  };
}

export function periodLabel(period, answer, startYear) {
  if (period === 'all') return `depuis ${startYear}`;
  if (period === '365') return 'sur les 12 derniers mois';
  if (period === '30') return 'sur les 30 derniers jours';
  return `en ${answer.year}`;
}

const nombre = (t) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(t).replace('-', '−')} °C`;

/** Phrase de réponse en français courant. */
export function phrase(city, { measure, direction, threshold }, answer) {
  const T = nombre(threshold);
  const mesure = measure === 'tx' ? 'maximale' : 'minimale';
  const debut = `Pour ${city.name}, la température ${mesure}`;
  const ge = direction === 'ge';
  if (answer.daysAgo == null) {
    return `${debut} ${ge ? `n'a jamais atteint ${T}` : `n'est jamais descendue à ${T} ou moins`} sur la période couverte.`;
  }
  const fait = ge ? `a atteint ou dépassé ${T}` : `est descendue à ${T} ou moins`;
  if (answer.daysAgo === 0) return `${debut} ${fait} aujourd'hui.`;
  const quand = answer.daysAgo === 1 ? 'hier' : `il y a ${new Intl.NumberFormat('fr-FR').format(answer.daysAgo)} jours`;
  return `${debut} ${fait} pour la dernière fois le ${formatLong(answer.lastIso)} (${quand}).`;
}
