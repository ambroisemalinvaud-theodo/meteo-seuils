import { computeThresholds, thresholdList, reaches } from '../js/thresholds.js';
import { addDays, formatLong, isoToDay, weekdayMonday0 } from '../js/dates.js';
import { emptySeries, mergeDaily, lastIso } from '../js/series.js';
import { answerQuestion, phrase } from '../js/questions.js';

const serie = (tx, tn = tx.map(() => 0), start = '2026-01-01') => ({ start, tx, tn });
const ligne = (s, t, o = {}) => computeThresholds(s, { min: t, max: t, ...o })[0];

function egal(reel, attendu, msg = '') {
  const a = JSON.stringify(reel), b = JSON.stringify(attendu);
  if (a !== b) throw new Error(`${msg} attendu ${b}, obtenu ${a}`);
}
function proche(reel, attendu, tol, msg = '') {
  if (Math.abs(reel - attendu) > tol) throw new Error(`${msg} attendu ≈ ${attendu}, obtenu ${reel}`);
}

export const tests = [
  ['seuil jamais atteint', () => {
    const r = ligne(serie([10, 12, 15, 11]), 30);
    egal([r.lastIso, r.daysAgo, r.count365, r.avgPerYear], [null, null, 0, 0]);
  }],
  ['seuil atteint aujourd’hui (≥ avec égalité)', () => {
    const r = ligne(serie([10, 12, 25]), 25);
    egal([r.lastIso, r.daysAgo, r.count365], ['2026-01-03', 0, 1]);
  }],
  ['dernière date = la plus récente, jours écoulés corrects', () => {
    const r = ligne(serie([30, 5, 31, 5, 5]), 30);
    egal([r.lastIso, r.daysAgo, r.count365], ['2026-01-03', 2, 2]);
  }],
  ['valeurs manquantes ignorées', () => {
    const r = ligne(serie([30, null, undefined, NaN]), 30);
    egal([r.lastIso, r.daysAgo], ['2026-01-01', 3]);
    proche(r.avgPerYear, 1 / (1 / 365.25), 0.01, 'un seul jour valide :');
  }],
  ['tout manquant : aucune ligne atteinte, pas de division par zéro', () => {
    const r = ligne(serie([null, null]), 0);
    egal([r.lastIso, r.avgPerYear], [null, null]);
  }],
  ['sens ≤ (descend sous)', () => {
    const r = ligne(serie([-3, 4, 2, 8]), 2, { direction: 'le' });
    egal([r.lastIso, r.daysAgo, r.count365], ['2026-01-03', 1, 2]);
  }],
  ['mesure Tn utilise la série des minimales', () => {
    const r = ligne(serie([30, 30], [1, 20]), 15, { measure: 'tn' });
    egal([r.lastIso, r.daysAgo], ['2026-01-02', 0]);
  }],
  ['fenêtre des 365 derniers jours : bornes exactes', () => {
    const tx = Array(400).fill(0);
    tx[34] = 20; // il y a 365 jours -> hors fenêtre
    tx[35] = 20; // il y a 364 jours -> dans la fenêtre
    const r = ligne(serie(tx), 20);
    egal([r.count365, r.daysAgo], [1, 364]);
  }],
  ['moyenne par an', () => {
    const tx = Array(730).fill(0);
    for (let i = 0; i < 10; i++) tx[i * 10] = 20;
    proche(ligne(serie(tx), 20).avgPerYear, 10 / (730 / 365.25), 1e-9);
  }],
  ['liste des seuils selon le pas', () => {
    egal(thresholdList(5), [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40]);
    egal(thresholdList(1).length, 53);
    egal(thresholdList(2).slice(-2), [40, 42]);
  }],
  ['reaches', () => {
    egal([reaches(5, 5, 'ge'), reaches(4.9, 5, 'ge'), reaches(5, 5, 'le'), reaches(null, 5, 'le')], [true, false, true, false]);
  }],
  ['dates : aucun décalage d’un jour', () => {
    egal(addDays('2024-02-28', 1), '2024-02-29');
    egal(addDays('2026-03-29', 1), '2026-03-30'); // passage à l’heure d’été
    egal(addDays('2026-10-25', 1), '2026-10-26'); // passage à l’heure d’hiver
    egal(isoToDay('2026-01-02') - isoToDay('2026-01-01'), 1);
    egal(weekdayMonday0('2026-09-15'), 1);
    if (!formatLong('2026-09-15').includes('mardi 15 septembre 2026')) throw new Error(formatLong('2026-09-15'));
  }],
  ['fusion des données : extension, trous, règle d’écrasement', () => {
    const s = emptySeries('2026-01-01');
    mergeDaily(s, { time: ['2026-01-01', '2026-01-02'], temperature_2m_max: [5, 6], temperature_2m_min: [1, 2] });
    egal(lastIso(s), '2026-01-02');
    // saut de 2 jours : on comble avec des null
    mergeDaily(s, { time: ['2026-01-05'], temperature_2m_max: [9], temperature_2m_min: [3] });
    egal(s.tx, [5, 6, null, null, 9]);
    // un jour entièrement nul n’étend pas la série
    mergeDaily(s, { time: ['2026-01-06'], temperature_2m_max: [null], temperature_2m_min: [null] });
    egal(s.tx.length, 5);
    // canWrite refuse d’écraser
    mergeDaily(s, { time: ['2026-01-01'], temperature_2m_max: [99], temperature_2m_min: [99] }, (iso, old) => old == null);
    egal(s.tx[0], 5);
  }],
  ['mesure Moy utilise la série des moyennes', () => {
    const s = { ...serie([30, 30], [1, 1]), tm: [10, 18] };
    const r = ligne(s, 15, { measure: 'tm' });
    egal([r.lastIso, r.daysAgo], ['2026-01-02', 0]);
    egal(ligne({ ...serie([30]), tm: undefined }, 15, { measure: 'tm' }).lastIso, null); // ancien cache sans moyennes
  }],
  ['fusion : les moyennes sont enregistrées et alignées', () => {
    const s = emptySeries('2026-01-01');
    mergeDaily(s, { time: ['2026-01-02'], temperature_2m_max: [5], temperature_2m_min: [1], temperature_2m_mean: [3] });
    egal([s.tx, s.tn, s.tm], [[null, 5], [null, 1], [null, 3]]);
  }],
  ['question : jamais atteint / aujourd’hui / il y a N jours', () => {
    const s = serie([10, 20, 5, 5, 5]);
    egal(answerQuestion(s, { measure: 'tx', direction: 'ge', threshold: 30, period: 'all' }).lastIso, null);
    const a = answerQuestion(s, { measure: 'tx', direction: 'ge', threshold: 20, period: 'all' });
    egal([a.lastIso, a.daysAgo, a.count], ['2026-01-02', 3, 1]);
    const b = answerQuestion(s, { measure: 'tx', direction: 'le', threshold: 5, period: 'all' });
    egal([b.daysAgo, b.count], [0, 3]);
  }],
  ['question : période année (cy, y:) ne compte que cette année', () => {
    const s = serie([30, 30, 30, 30, 30], undefined, '2025-12-30'); // 30/12, 31/12, 01/01, 02/01, 03/01
    const q = (period) => answerQuestion(s, { measure: 'tx', direction: 'ge', threshold: 30, period });
    egal([q('cy').count, q('cy').year, q('cy').elapsedDays], [3, 2026, 3]);
    egal([q('y:2025').count, q('y:2025').elapsedDays], [2, 2]); // la série ne commence que le 30/12
    egal(q('y:2030').count, 0);
  }],
  ['question : fenêtres 30 jours et 365 jours', () => {
    const tx = Array(60).fill(0); tx[29] = 25; tx[30] = 25; // ref = 59 : idx 30 dans la fenêtre (29 jours avant), idx 29 hors
    const s = serie(tx);
    egal(answerQuestion(s, { measure: 'tx', direction: 'ge', threshold: 25, period: '30' }).count, 1);
    egal(answerQuestion(s, { measure: 'tx', direction: 'ge', threshold: 25, period: '365' }).count, 2);
  }],
  ['question : phrase en français', () => {
    const s = serie([10, 20, 5]);
    const city = { name: 'Saint-Cloud' };
    const p = phrase(city, { measure: 'tn', direction: 'le', threshold: 8 }, answerQuestion(s, { measure: 'tn', direction: 'le', threshold: 8, period: 'all' }));
    if (!p.includes('Pour Saint-Cloud') || !p.includes('minimale') || !p.includes('aujourd')) throw new Error(p);
    const j = phrase(city, { measure: 'tx', direction: 'ge', threshold: 38 }, { daysAgo: null });
    if (!j.includes('jamais atteint')) throw new Error(j);
  }],
];
