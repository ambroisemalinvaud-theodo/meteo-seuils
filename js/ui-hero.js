// « Grand résultat » : carte colorée selon le seuil, avec le nombre de jours en très grand.
import { formatLong } from './dates.js';
import { rgbCss, tempRgb, textOn } from './colors.js';

const nombre = new Intl.NumberFormat('fr-FR');

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

/**
 * titre : ligne du haut ; threshold : sert à choisir la couleur ;
 * direction : le dégradé part vers le chaud (≥) ou vers le froid (≤) ;
 * daysAgo/lastIso : null si jamais atteint ; stats : [{ valeur, libelle }] ; depuis : « depuis le … » au lieu de la date seule.
 */
export function buildHero({ titre, threshold, direction, daysAgo, lastIso, stats, depuis = false, classe = '' }) {
  const c1 = tempRgb(threshold);
  const c2 = tempRgb(Math.max(-10, Math.min(45, threshold + (direction === 'le' ? -8 : 8))));
  const hero = el('div', `hero ${classe}`.trim());
  hero.style.background = `linear-gradient(150deg, ${rgbCss(c1)}, ${rgbCss(c2)})`;
  hero.style.color = textOn(c1) === '#ffffff' ? '#fff' : '#10151c';

  const big = el('div', 'big num');
  if (lastIso == null) { big.textContent = 'Jamais'; big.classList.add('txt'); }
  else if (daysAgo === 0) { big.textContent = "Aujourd'hui"; big.classList.add('txt'); }
  else if (daysAgo === 1) { big.textContent = 'Hier'; big.classList.add('txt'); }
  else big.append(nombre.format(daysAgo), el('small', null, ' jours'));

  hero.append(el('div', 'k', titre), big);
  hero.append(el('div', 'when', lastIso ? `${depuis ? 'depuis le ' : ''}${formatLong(lastIso)}` : "Seuil jamais atteint sur la période couverte"));
  if (stats?.length) {
    const st = el('div', 'st');
    for (const s of stats) {
      const d = el('div');
      d.append(el('b', 'num', s.valeur), s.libelle);
      st.append(d);
    }
    hero.append(st);
  }
  return hero;
}
