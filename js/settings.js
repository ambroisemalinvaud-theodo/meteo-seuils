// Réglages et dernière ville, mémorisés dans localStorage (jamais envoyés nulle part).
const CLE = 'meteo-seuils:';
export const REGLAGES_DEFAUT = { measure: 'tx', direction: 'ge', step: 1 };

function lire(nom, defaut) {
  try {
    const v = localStorage.getItem(CLE + nom);
    return v ? JSON.parse(v) : defaut;
  } catch { return defaut; }
}
function ecrire(nom, valeur) {
  try { localStorage.setItem(CLE + nom, JSON.stringify(valeur)); } catch { /* mode privé : on ignore */ }
}

export function loadSettings() {
  const s = { ...REGLAGES_DEFAUT, ...lire('reglages', {}) };
  if (!['tx', 'tn'].includes(s.measure)) s.measure = 'tx';
  if (!['ge', 'le'].includes(s.direction)) s.direction = 'ge';
  if (![1, 2, 5].includes(Number(s.step))) s.step = 1;
  s.step = Number(s.step);
  return s;
}
export const saveSettings = (s) => ecrire('reglages', s);
export const loadLastCity = () => lire('ville', null);
export const saveLastCity = (c) => ecrire('ville', c);

// Questions rapides : favoris et dernier formulaire
export const loadFavoris = () => (Array.isArray(lire('favoris', [])) ? lire('favoris', []) : []);
export const saveFavoris = (f) => ecrire('favoris', f);
export const loadFormQ = () => lire('formulaire-q', {});
export const saveFormQ = (f) => ecrire('formulaire-q', f);
