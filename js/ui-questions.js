// Onglet "Questions rapides" : une phrase à compléter, la réponse s'affiche tout de suite.
import { DEBUT_HISTORIQUE } from './api.js';
import { formatLong } from './dates.js';
import { answerQuestion, periodLabel, phrase } from './questions.js';
import { lastIso } from './series.js';
import { loadFavoris, loadFormQ, saveFavoris, saveFormQ } from './settings.js';
import { cityLabel, initSearch } from './ui-search.js';
import { formatTemp, ilYa } from './ui-table.js';

const $ = (id) => document.getElementById(id);
const PREMIERE_ANNEE = Number(DEBUT_HISTORIQUE.slice(0, 4));
const SIGNE = { ge: '≥', le: '≤' };

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte != null) e.textContent = texte;
  return e;
}

const parseSeuil = (txt) => {
  const t = String(txt).replace(/\s/g, '').replace('−', '-').replace(',', '.');
  return t === '' || t === '-' ? NaN : Number(t);
};
const texteSeuil = (n) => String(n).replace('.', ',');
const villeMinimale = (c) => ({ key: c.key, name: c.name, admin1: c.admin1, admin2: c.admin2, country: c.country, lat: c.lat, lon: c.lon });

export function initQuestions({ defaultCity, readCached, isStale, updateSeries, onStored }) {
  const anneeCourante = new Date().getFullYear();
  const form = { city: defaultCity ? villeMinimale(defaultCity) : null, measure: 'tx', direction: 'ge', threshold: '25', period: 'cy', ...loadFormQ() };
  if (!form.city && defaultCity) form.city = villeMinimale(defaultCity);
  let favoris = loadFavoris();
  let jeton = 0;

  /* --- Champs --- */
  const sel = $('q-periode');
  sel.add(new Option(`Année en cours (${anneeCourante})`, 'cy'));
  sel.add(new Option('12 derniers mois', '365'));
  sel.add(new Option('30 derniers jours', '30'));
  sel.add(new Option(`Depuis ${PREMIERE_ANNEE}`, 'all'));
  for (let y = anneeCourante - 1; y >= PREMIERE_ANNEE; y--) sel.add(new Option(String(y), `y:${y}`));

  function versChamps() {
    $('q-ville').value = form.city ? cityLabel(form.city) : '';
    document.querySelector(`input[name="qmeasure"][value="${form.measure}"]`).checked = true;
    document.querySelector(`input[name="qdirection"][value="${form.direction}"]`).checked = true;
    $('q-seuil').value = form.threshold;
    sel.value = [...sel.options].some((o) => o.value === form.period) ? form.period : 'cy';
    form.period = sel.value;
    majEtoile();
  }

  const planifier = (() => {
    let t;
    return () => { clearTimeout(t); t = setTimeout(poser, 250); };
  })();

  function modifie(champs) {
    Object.assign(form, champs);
    saveFormQ(form);
    majEtoile();
    planifier();
  }

  document.querySelectorAll('input[name="qmeasure"]').forEach((r) => r.addEventListener('change', () => modifie({ measure: r.value })));
  document.querySelectorAll('input[name="qdirection"]').forEach((r) => r.addEventListener('change', () => modifie({ direction: r.value })));
  $('q-seuil').addEventListener('input', (e) => modifie({ threshold: e.target.value }));
  sel.addEventListener('change', () => modifie({ period: sel.value }));
  const pas = (d) => {
    const t = parseSeuil(form.threshold);
    const n = (Number.isFinite(t) ? t : 0) + d;
    $('q-seuil').value = texteSeuil(n);
    modifie({ threshold: texteSeuil(n) });
  };
  $('q-moins').addEventListener('click', () => pas(-1));
  $('q-plus').addEventListener('click', () => pas(1));
  $('q-form').addEventListener('submit', (e) => e.preventDefault());
  initSearch({ input: $('q-ville'), list: $('q-suggestions'), onPick: (c) => modifie({ city: villeMinimale(c) }) });

  /* --- Favoris --- */
  const cle = (q) => JSON.stringify([q.city?.key, q.measure, q.direction, parseSeuil(q.threshold), q.period]);
  const indexFavori = () => favoris.findIndex((f) => cle(f) === cle(form));

  function majEtoile() {
    const b = $('q-etoile');
    const on = indexFavori() >= 0;
    b.textContent = on ? '★ Question enregistrée' : '☆ Enregistrer cette question';
    b.setAttribute('aria-pressed', String(on));
    b.disabled = !form.city || !Number.isFinite(parseSeuil(form.threshold));
  }

  function libelle(q) {
    const per = { cy: 'année en cours', 365: '12 mois', 30: '30 jours', all: `depuis ${PREMIERE_ANNEE}` }[q.period] ?? q.period.slice(2);
    return `${q.city.name} · ${q.measure === 'tx' ? 'Tx' : 'Tn'} ${SIGNE[q.direction]} ${formatTemp(parseSeuil(q.threshold))} · ${per}`;
  }

  function rendreFavoris() {
    const box = $('q-favs');
    box.replaceChildren();
    if (!favoris.length) {
      box.append(el('p', 'aide', 'Enregistrez une question avec ☆ pour la retrouver en un geste.'));
      return;
    }
    favoris.forEach((f, i) => {
      const w = el('span', 'fav');
      const b = el('button', 'chip', libelle(f));
      b.type = 'button';
      b.addEventListener('click', () => {
        Object.assign(form, { city: f.city, measure: f.measure, direction: f.direction, threshold: f.threshold, period: f.period });
        saveFormQ(form);
        versChamps();
        poser();
      });
      const x = el('button', 'chip-x', '✕');
      x.type = 'button';
      x.setAttribute('aria-label', `Supprimer la question : ${libelle(f)}`);
      x.addEventListener('click', () => {
        favoris.splice(i, 1);
        saveFavoris(favoris);
        rendreFavoris();
        majEtoile();
      });
      w.append(b, x);
      box.append(w);
    });
  }

  $('q-etoile').addEventListener('click', () => {
    const i = indexFavori();
    if (i >= 0) favoris.splice(i, 1);
    else favoris.push({ city: form.city, measure: form.measure, direction: form.direction, threshold: form.threshold, period: form.period });
    saveFavoris(favoris);
    rendreFavoris();
    majEtoile();
  });

  /* --- Réponse --- */
  const msg = (texte) => $('q-resultat').replaceChildren(el('p', 'aide', texte));
  const setErreur = (t) => { $('q-erreur').textContent = t || ''; $('q-erreur').hidden = !t; };
  const setProg = (p) => {
    $('q-prog').hidden = p == null;
    if (p != null) { $('q-barre').value = Math.round(p * 100); $('q-prog-texte').textContent = `Téléchargement de l'historique… ${Math.round(p * 100)} %`; }
  };

  function afficher(rec, note) {
    const q = { measure: form.measure, direction: form.direction, threshold: parseSeuil(form.threshold), period: form.period };
    const fin = lastIso(rec);
    const r = answerQuestion(rec, q, fin);
    const startYear = Number(rec.start.slice(0, 4));
    const carte = el('div', 'carte resultat');
    carte.append(el('p', 'phrase', phrase(form.city, q, r)));

    const stats = el('div', 'stats');
    const tuile = (titre, grand, petit) => {
      const t = el('div', 'stat');
      t.append(el('span', 'stat-t', titre), el('strong', null, grand), el('span', 'stat-p', petit || ' '));
      stats.append(t);
    };
    tuile('Depuis la dernière fois', r.lastIso ? ilYa(r.daysAgo) : 'Jamais', r.lastIso ? '' : `depuis ${startYear}`);
    tuile('Dernière fois', r.lastIso ? formatLong(r.lastIso) : '—');
    const nb = new Intl.NumberFormat('fr-FR');
    tuile(`Jours ${periodLabel(q.period, r, startYear)}`, nb.format(r.count), `sur ${nb.format(r.validDays)} jours de données`);
    carte.append(stats);
    carte.append(el('p', 'note', `${note ? `${note} ` : ''}Données jusqu'au ${formatLong(fin)}.`));
    $('q-resultat').replaceChildren(carte);
  }

  async function poser() {
    const mien = ++jeton;
    setErreur('');
    const t = parseSeuil(form.threshold);
    if (!form.city) return msg('Choisissez une ville pour obtenir une réponse.');
    if (!Number.isFinite(t)) return msg('Saisissez un seuil en °C (par exemple 22 ou 22,5).');

    let rec = await readCached(form.city);
    if (mien !== jeton) return;
    if (rec) afficher(rec);
    else msg(`Téléchargement de l'historique de ${form.city.name}…`);
    if (!isStale(rec)) return;

    if (!rec) setProg(0);
    try {
      rec = await updateSeries(form.city, rec, (p) => mien === jeton && setProg(p));
      onStored?.();
      if (mien === jeton) afficher(rec);
    } catch (e) {
      if (mien !== jeton) return;
      setErreur(e.message || 'Une erreur est survenue.');
      if (!rec) msg('Aucune donnée disponible pour cette ville pour le moment.');
    } finally {
      if (mien === jeton) setProg(null);
    }
  }

  versChamps();
  rendreFavoris();
  return { poser };
}
