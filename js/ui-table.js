// Liste des seuils : une ligne par seuil, lisible sans défilement latéral.
import { formatLong } from './dates.js';

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatTemp = (t) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(t).replace('-', '−')} °C`;

export function ilYa(jours) {
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  let txt = `${nombre.format(jours)} jours`;
  if (jours >= 365) txt += ` (≈ ${decimal.format(jours / 365.25)} ans)`;
  return txt;
}

/** Tri : les valeurs absentes (seuil jamais atteint) restent toujours en bas. */
export function sortRows(rows, { key, dir }) {
  const sens = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return a.threshold - b.threshold;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -sens;
    if (va > vb) return sens;
    return a.threshold - b.threshold;
  });
}

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

export function renderTable(wrap, rows, { sort, selected, direction, onSelect }) {
  const signe = direction === 'le' ? '≤' : '≥';
  const frag = document.createDocumentFragment();

  for (const r of sortRows(rows, sort)) {
    const ligne = el('div', 'seuil-ligne');
    ligne.setAttribute('role', 'listitem');
    ligne.tabIndex = 0;
    ligne.dataset.seuil = r.threshold;
    if (r.lastIso == null) ligne.classList.add('jamais');
    if (r.threshold === selected) { ligne.classList.add('choisi'); ligne.setAttribute('aria-current', 'true'); }

    ligne.append(el('span', 'seuil-val', `${signe} ${formatTemp(r.threshold)}`));
    if (r.lastIso) {
      const pill = el('span', `pill${r.daysAgo <= 7 ? ' p1' : r.daysAgo <= 30 ? ' p2' : ''}`, ilYa(r.daysAgo));
      ligne.append(pill, el('span', 'seuil-date', formatLong(r.lastIso)));
      const n = r.count365;
      const moy = r.avgPerYear == null ? '—' : decimal.format(r.avgPerYear);
      ligne.append(el('span', 'seuil-stats', `${nombre.format(n)} j sur les 365 derniers · moy. ${moy} j/an`));
    } else {
      ligne.append(el('span', 'seuil-date', 'Jamais atteint'));
    }

    const choisir = () => onSelect(r.threshold === selected ? null : r.threshold);
    ligne.addEventListener('click', choisir);
    ligne.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); }
    });
    frag.append(ligne);
  }
  wrap.replaceChildren(frag);
}
