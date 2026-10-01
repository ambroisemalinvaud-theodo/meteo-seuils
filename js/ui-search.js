// Recherche de ville avec suggestions (nom, région, pays pour distinguer les homonymes).
import { searchCities } from './api.js';
import { cityKey } from './db.js';

export const cityLabel = (c) => [c.name, c.admin1, c.country].filter(Boolean).join(', ');

export function initSearch({ input, list, onPick }) {
  let timer;
  let ctrl;
  let items = [];
  let actif = -1;

  const fermer = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    actif = -1;
  };
  const ouvrir = () => {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const message = (texte) => {
    list.textContent = '';
    const li = document.createElement('li');
    li.className = 'info';
    li.textContent = texte;
    list.append(li);
    items = [];
    ouvrir();
  };
  const choisir = (c) => {
    fermer();
    input.blur();
    onPick({ ...c, key: cityKey(c.lat, c.lon) });
  };
  const surligner = (i) => {
    actif = i;
    [...list.children].forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) list.children[i].scrollIntoView({ block: 'nearest' });
  };

  function afficher(results) {
    list.textContent = '';
    items = results;
    if (!results.length) return message('Aucune ville trouvée.');
    results.forEach((c, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.id = `sugg-${i}`;
      const nom = document.createElement('strong');
      nom.textContent = c.name;
      const detail = document.createElement('span');
      detail.textContent = [c.admin1, c.admin2 !== c.admin1 ? c.admin2 : '', c.country].filter(Boolean).join(' · ');
      li.append(nom, detail);
      // pointerdown plutôt que click : évite que le "blur" du champ ferme la liste avant la sélection
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); choisir(c); });
      list.append(li);
    });
    ouvrir();
  }

  async function chercher(q) {
    ctrl?.abort();
    ctrl = new AbortController();
    message('Recherche…');
    try {
      afficher(await searchCities(q, ctrl.signal));
    } catch (e) {
      if (e.name === 'AbortError') return;
      message(e.message);
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { ctrl?.abort(); fermer(); return; }
    timer = setTimeout(() => chercher(q), 300);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fermer();
    else if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); surligner(Math.min(actif + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); surligner(Math.max(actif - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (actif >= 0) choisir(items[actif]);
      else if (items.length) choisir(items[0]);
    }
  });
  input.addEventListener('blur', () => setTimeout(fermer, 150));
  input.addEventListener('focus', () => input.select());
}
