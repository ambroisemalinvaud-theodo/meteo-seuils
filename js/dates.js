// Dates "calendaires" : on manipule des textes AAAA-MM-JJ, jamais d'heure locale.
// Tout passe par Date.UTC, donc aucun décalage d'un jour lié au fuseau horaire.
const MS_PAR_JOUR = 86400000;

export function isoToDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PAR_JOUR);
}

export function dayToIso(n) {
  return new Date(n * MS_PAR_JOUR).toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  return dayToIso(isoToDay(iso) + n);
}

const fmtLong = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});
const fmtMois = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });

/** « mardi 15 septembre 2026 » */
export function formatLong(iso) {
  return fmtLong.format(new Date(isoToDay(iso) * MS_PAR_JOUR));
}

/** Nom du mois (0 = janvier) */
export function nomMois(m) {
  return fmtMois.format(new Date(Date.UTC(2001, m, 1)));
}

/** Jour de la semaine, lundi = 0 */
export function weekdayMonday0(iso) {
  return (new Date(isoToDay(iso) * MS_PAR_JOUR).getUTCDay() + 6) % 7;
}

export function daysInMonth(year, month0) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date du jour côté UTC (sert seulement à décider quoi télécharger). */
export function todayUtcIso() {
  return new Date().toISOString().slice(0, 10);
}
