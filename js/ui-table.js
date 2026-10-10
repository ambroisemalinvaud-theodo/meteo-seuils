// Liste des seuils : une bande de couleur par seuil (couleur = température), sans défilement latéral.
import { formatLong } from './dates.js';
import { rgbCss, tempRgb, textOn } from './colors.js';

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatTemp = (t) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(t).replace('-', '−')} °C`;
export const formatDecimal = (n) => decimal.format(n);
export const formatNombre = (n) => nombre.format(n);

export function ilYa(jours) {
  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Hier';
  let txt = `${nombre.format(jours)} jours`;
  if (jours >= 365) txt += ` (≈ ${decimal.format(jours / 365.25)} ans)`;
  return txt;
}

const ilYaCourt = (j) => (j === 0 ? 'auj.' : j === 1 ? 'hier' : `${nombre.format(j)} j`);

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
    const bande = el('button', 'blk');
    bande.type = 'button';
    bande.dataset.seuil = r.threshold;
    bande.setAttribute('aria-pressed', String(r.threshold === selected));
    if (r.threshold === selected) bande.classList.add('sel');

    bande.append(el('span', 't num', `${signe} ${formatTemp(r.threshold)}`));
    if (r.lastIso) {
      const c = tempRgb(r.threshold);
      bande.style.background = rgbCss(c);
      bande.style.color = textOn(c);
      bande.append(el('span', 'd', formatLong(r.lastIso)), el('span', 'a num', ilYaCourt(r.daysAgo)));
    } else {
      bande.classList.add('never');
      bande.append(el('span', 'd', 'Jamais atteint'), el('span', 'a'));
    }
    bande.addEventListener('click', () => onSelect(r.threshold));
    frag.append(bande);
  }
  wrap.replaceChildren(frag);
}
