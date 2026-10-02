// Accès aux séries de températures : cache IndexedDB + mise à jour via l'API.
// Partagé par l'écran principal et les questions rapides.
import { syncSeries } from './api.js';
import { getCity, putCity } from './db.js';

const FRAICHEUR_MS = 6 * 3600 * 1000; // remise à jour automatique après 6 h
const enCours = new Map();

export async function readCached(city) {
  try { return (await getCity(city.key)) || null; } catch { return null; }
}

export const isStale = (rec) => !rec || Date.now() - (rec.updated || 0) > FRAICHEUR_MS;

/** Télécharge (1re fois) ou complète (jours manquants) la série, puis l'enregistre. */
export function updateSeries(city, rec, onProgress) {
  if (enCours.has(city.key)) return enCours.get(city.key); // évite un double téléchargement
  const p = (async () => {
    const serie = await syncSeries(city, rec, rec ? undefined : onProgress);
    Object.assign(serie, { key: city.key, name: city.name, admin1: city.admin1, admin2: city.admin2, country: city.country, lat: city.lat, lon: city.lon });
    try { await putCity(serie); } catch { /* stockage impossible : l'affichage reste correct */ }
    return serie;
  })().finally(() => enCours.delete(city.key));
  enCours.set(city.key, p);
  return p;
}
