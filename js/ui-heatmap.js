// Calendrier annuel : une case par jour, colorée selon la mesure choisie.
import { daysInMonth, formatLong, isoToDay, nomMoisCourt, pad2, weekdayMonday0 } from './dates.js';
import { reaches } from './thresholds.js';
import { seriesFor } from './series.js';
import { formatTemp } from './ui-table.js';

import { tempColor } from './colors.js';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const val = (arr, i) => (arr[i] == null || Number.isNaN(arr[i]) ? null : arr[i]);

/** Dessine l'année. Retourne le nombre de jours atteignant le seuil (si un seuil est choisi). */
export function renderHeatmap(root, { series, year, measure, direction, threshold, lastIso }) {
  const startDay = isoToDay(series.start);
  const serie = seriesFor(series, measure);
  let nbHits = 0;
  const frag = document.createDocumentFragment();

  for (let m = 0; m < 12; m++) {
    const bloc = document.createElement('div');
    bloc.className = 'mois';
    const titre = document.createElement('h3');
    titre.textContent = nomMoisCourt(m);
    const jours = document.createElement('div');
    jours.className = 'jours-sem';
    JOURS.forEach((j) => { const s = document.createElement('span'); s.textContent = j; jours.append(s); });
    const grille = document.createElement('div');
    grille.className = 'grille';

    const n = daysInMonth(year, m);
    for (let d = 1; d <= n; d++) {
      const iso = `${year}-${pad2(m + 1)}-${pad2(d)}`;
      const i = isoToDay(iso) - startDay;
      const v = val(serie, i);
      const cell = document.createElement('div');
      cell.className = 'jour';
      cell.dataset.iso = iso;
      if (d === 1) cell.style.gridColumnStart = weekdayMonday0(iso) + 1;
      if (v == null) cell.classList.add('vide');
      else cell.style.background = tempColor(v);
      if (threshold != null) {
        if (reaches(v, threshold, direction)) { cell.classList.add('hit'); nbHits++; }
        else cell.classList.add('dim');
        if (iso === lastIso) cell.classList.add('last');
      }
      grille.append(cell);
    }
    bloc.append(titre, jours, grille);
    frag.append(bloc);
  }
  root.replaceChildren(frag);
  return nbHits;
}

/** Infobulle : survol (souris) ou toucher. `getSeries` donne la série affichée. */
export function initTooltip(root, tip, getSeries, getContext) {
  let courant = null;

  const masquer = () => { tip.hidden = true; courant = null; };
  function montrer(cell) {
    const series = getSeries();
    if (!series) return;
    const iso = cell.dataset.iso;
    const i = isoToDay(iso) - isoToDay(series.start);
    const tx = val(series.tx, i);
    const tn = val(series.tn, i);
    const tm = val(series.tm || [], i);
    const f = (v) => (v == null ? '—' : formatTemp(v));
    const { threshold, measure, direction } = getContext();
    let txt = `${formatLong(iso)}\nMax ${f(tx)} · Min ${f(tn)} · Moy ${f(tm)}`;
    if (threshold != null && cell.classList.contains('hit')) txt += `\nSeuil ${direction === 'le' ? '≤' : '≥'} ${formatTemp(threshold)} atteint`;
    tip.textContent = txt;
    tip.hidden = false;
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, document.documentElement.clientWidth - w - 8));
    let y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    courant = cell;
  }

  root.addEventListener('pointerover', (e) => {
    const c = e.target.closest?.('.jour');
    if (c && e.pointerType === 'mouse') montrer(c);
  });
  root.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse') masquer(); });
  root.addEventListener('click', (e) => {
    const c = e.target.closest?.('.jour');
    if (!c) return masquer();
    if (c === courant && e.pointerType !== 'mouse') masquer(); else montrer(c);
    e.stopPropagation();
  });
  document.addEventListener('click', masquer);
  window.addEventListener('scroll', masquer, { passive: true });
  return masquer;
}
