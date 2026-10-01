// Cache IndexedDB : une entrée par ville, clé = latitude/longitude arrondies à 2 décimales.
const NOM_BASE = 'meteo-seuils';
const STORE = 'villes';

export const cityKey = (lat, lon) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

let dbPromise;
function ouvrir() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_BASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'key' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

async function requete(mode, fn) {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

export const getCity = (key) => requete('readonly', (s) => s.get(key));
export const putCity = (record) => requete('readwrite', (s) => s.put(record));
export const listCities = () => requete('readonly', (s) => s.getAll());
