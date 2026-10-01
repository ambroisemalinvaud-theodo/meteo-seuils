// Tableau des seuils : tri, mise en évidence, sélection d'une ligne.
import { formatLong } from './dates.js';

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatTemp = (t) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(t).replace('-', '−')} °C`;

function ilYa(jours) {
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  let txt = `${nombre.format(jours)} jours`;
  if (jours >= 365) txt += ` (≈ ${decimal.format(jours / 365.25)} ans)`;
  return txt;
}

const COLONNES = [
  { key: 'threshold', label: 'Seuil' },
  { key: 'lastIso', label: 'Dernière fois atteint' },
  { key: 'daysAgo', label: 'Il y a' },
  { key: 'count365', label: 'Jours sur les 365 derniers' },
  { key: 'avgPerYear', label: 'Moyenne de jours par an' },
];

/** Tri : les valeurs absentes (seuil jamais atteint) restent toujours en bas. */
export function sortRows(rows, { key, dir }) {
  const sens = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let va = a[key];
    let vb = b[key];
    if (va == null && vb == null) return a.threshold - b.threshold;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -sens;
    if (va > vb) return sens;
    return a.threshold - b.threshold;
  });
}

export function renderTable(wrap, rows, { sort, selected, direction, onSelect, onSort }) {
  const signe = direction === 'le' ? '≤' : '≥';
  const table = document.createElement('table');

  const thead = table.createTHead().insertRow();
  for (const col of COLONNES) {
    const th = document.createElement('th');
    th.scope = 'col';
    const actif = sort.key === col.key;
    th.setAttribute('aria-sort', actif ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = col.label;
    if (actif) b.dataset.dir = sort.dir === 'asc' ? '▲' : '▼';
    b.addEventListener('click', () => onSort(col.key));
    th.append(b);
    thead.append(th);
  }

  const tbody = table.createTBody();
  for (const r of sortRows(rows, sort)) {
    const tr = tbody.insertRow();
    tr.tabIndex = 0;
    tr.dataset.seuil = r.threshold;
    if (r.lastIso == null) tr.classList.add('jamais');
    else if (r.daysAgo <= 7) tr.classList.add('recent1');
    else if (r.daysAgo <= 30) tr.classList.add('recent2');
    if (r.threshold === selected) { tr.classList.add('choisi'); tr.setAttribute('aria-selected', 'true'); }

    tr.insertCell().textContent = `${signe} ${formatTemp(r.threshold)}`;
    tr.insertCell().textContent = r.lastIso ? formatLong(r.lastIso) : 'Jamais atteint';
    tr.insertCell().textContent = r.lastIso ? ilYa(r.daysAgo) : '—';
    tr.insertCell().textContent = nombre.format(r.count365);
    tr.insertCell().textContent = r.avgPerYear == null ? '—' : decimal.format(r.avgPerYear);
    tr.cells[0].className = 'seuil';

    const choisir = () => onSelect(r.threshold === selected ? null : r.threshold);
    tr.addEventListener('click', choisir);
    tr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); }
    });
  }
  const scroll = wrap.scrollLeft;
  wrap.replaceChildren(table);
  wrap.scrollLeft = scroll;
}
