// Appels à Open-Meteo (gratuit, sans clé, autorise les appels depuis un navigateur).
import { addDays, todayUtcIso } from './dates.js';
import { emptySeries, mergeDaily } from './series.js';

export const DEBUT_HISTORIQUE = '1940-01-01';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
// L'archive a quelques jours de retard : on la demande jusqu'à J-6, le reste vient de "forecast".
const RETARD_ARCHIVE_JOURS = 6;
const OCTETS_PAR_JOUR = 22.5; // pour estimer la barre de progression

export class ApiError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}

async function getJson(url, { signal, onProgress, estimatedBytes } = {}) {
  let res;
  const timeout = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(90000) : undefined;
  const sig = signal && timeout && AbortSignal.any ? AbortSignal.any([signal, timeout]) : signal || timeout;
  try {
    res = await fetch(url, { signal: sig });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError('network', navigator.onLine === false
      ? 'Vous êtes hors ligne : les dernières données enregistrées restent affichées.'
      : 'Impossible de joindre Open-Meteo. Vérifiez votre connexion puis réessayez.');
  }
  if (res.status === 429) {
    throw new ApiError('rate', 'Open-Meteo limite le nombre de requêtes gratuites. Réessayez dans quelques minutes (ou demain si la limite du jour est atteinte).');
  }
  if (!res.ok) {
    let raison = '';
    try { raison = (await res.json()).reason || ''; } catch { /* ignore */ }
    throw new ApiError('http', `Open-Meteo a répondu par une erreur (${res.status}). ${raison}`.trim());
  }
  try {
    if (onProgress && res.body?.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let recu = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        recu += value.length;
        onProgress(Math.min(0.98, recu / (estimatedBytes || recu * 2)));
      }
      const all = new Uint8Array(recu);
      let pos = 0;
      for (const c of chunks) { all.set(c, pos); pos += c.length; }
      onProgress(1);
      return JSON.parse(new TextDecoder().decode(all));
    }
    return await res.json();
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new ApiError('network', 'Le téléchargement a été interrompu. Réessayez.');
  }
}

export async function searchCities(name, signal) {
  const url = `${GEO}?name=${encodeURIComponent(name)}&count=5&language=fr`;
  const data = await getJson(url, { signal });
  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1 || '',
    admin2: r.admin2 || '',
    country: r.country || '',
    lat: r.latitude,
    lon: r.longitude,
  }));
}

function fetchArchive(city, from, to, onProgress) {
  const jours = (Date.parse(to) - Date.parse(from)) / 86400000;
  const url = `${ARCHIVE}?latitude=${city.lat}&longitude=${city.lon}&start_date=${from}&end_date=${to}`
    + '&daily=temperature_2m_max,temperature_2m_min&timezone=auto';
  return getJson(url, { onProgress, estimatedBytes: jours * OCTETS_PAR_JOUR });
}

function fetchRecent(city, pastDays) {
  const url = `${FORECAST}?latitude=${city.lat}&longitude=${city.lon}`
    + `&daily=temperature_2m_max,temperature_2m_min&past_days=${pastDays}&forecast_days=1&timezone=auto`;
  return getJson(url);
}

/**
 * Met à jour la série d'une ville : télécharge tout l'historique la 1re fois,
 * ensuite uniquement les jours manquants. Retourne la série à jour.
 */
export async function syncSeries(city, existing, onProgress) {
  const series = existing || emptySeries(DEBUT_HISTORIQUE);
  const limite = addDays(todayUtcIso(), -RETARD_ARCHIVE_JOURS);

  if (!series.archiveEnd || series.archiveEnd < limite) {
    const from = series.archiveEnd ? addDays(series.archiveEnd, -3) : DEBUT_HISTORIQUE;
    const data = await fetchArchive(city, from, limite, onProgress);
    // L'archive fait foi : elle écrase ce qui est déjà stocké.
    const fin = mergeDaily(series, data.daily);
    if (fin) series.archiveEnd = fin;
  }

  const recent = await fetchRecent(city, 14);
  // Les jours récents (hors archive) viennent de "forecast", sans écraser l'archive.
  mergeDaily(series, recent.daily, (iso, ancienne) => ancienne == null || !series.archiveEnd || iso > series.archiveEnd);

  series.updated = Date.now();
  return series;
}
