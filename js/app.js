// Point d'entrée : relie les modules, garde l'état de l'application.
import { computeThresholds } from './thresholds.js';
import { formatCourt, formatLong, todayUtcIso } from './dates.js';
import { lastIso } from './series.js';
import { ApiError } from './api.js';
import { listCities } from './db.js';
import { isStale, readCached, updateSeries } from './store.js';
import { initQuestions } from './ui-questions.js';
import { loadLastCity, loadSeuil, loadSettings, saveLastCity, saveSeuil, saveSettings } from './settings.js';
import { cityLabel, initSearch } from './ui-search.js';
import { formatDecimal, formatNombre, formatTemp, renderTable } from './ui-table.js';
import { initTooltip, renderHeatmap } from './ui-heatmap.js';
import { legendGradient } from './colors.js';
import { buildHero } from './ui-hero.js';

const $ = (id) => document.getElementById(id);
const NOM_MESURE = { tx: 'Max', tn: 'Min', tm: 'Moy' };

const state = {
  city: null,
  series: null,
  settings: loadSettings(),
  year: Number(todayUtcIso().slice(0, 4)),
  selected: loadSeuil(),
  sort: { key: 'threshold', dir: 'asc' },
  token: 0,
};

/* ---------- Affichage ---------- */

function resumeReglages() {
  const { measure, direction, step } = state.settings;
  $('reglages-btn').textContent = `${NOM_MESURE[measure]} ${direction === 'ge' ? '≥' : '≤'} · pas ${step} °C`;
}

function showError(msg) {
  const el = $('erreur');
  el.textContent = msg || '';
  el.hidden = !msg;
}

/** Seuil proposé par défaut : le plus extrême atteint sur les 365 derniers jours (le plus haut pour ≥, le plus bas pour ≤). */
function seuilParDefaut(rows, direction) {
  const atteints = rows.filter((r) => r.count365 > 0);
  if (!atteints.length) return rows[Math.floor(rows.length / 2)].threshold;
  return direction === 'le' ? atteints[0].threshold : atteints[atteints.length - 1].threshold;
}

/** Garde le seuil choisi ; s'il n'existe plus (changement de pas), prend le plus proche. */
function seuilValide(rows, direction) {
  if (state.selected == null) return seuilParDefaut(rows, direction);
  return rows.reduce((best, r) => (Math.abs(r.threshold - state.selected) < Math.abs(best - state.selected) ? r.threshold : best), rows[0].threshold);
}

function render() {
  const { series, settings, city } = state;
  resumeReglages();
  $('rafraichir').disabled = !city;
  $('titre-ville').textContent = city ? city.name : 'Seuils météo';
  $('cal-ville').textContent = city ? city.name : '';
  if (!series || !series.tx.length) {
    $('table-wrap').replaceChildren();
    $('hero').replaceChildren();
    $('calendrier').replaceChildren();
    $('cal-resume').textContent = '';
    $('cal-meta').textContent = '';
    if (!city) $('statut').textContent = 'Choisissez une ville pour commencer.';
    return;
  }
  const fin = lastIso(series);
  const maj = series.updated ? new Date(series.updated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const lieu = [city.admin1, city.country].filter(Boolean).join(', ');
  $('statut').textContent = `${lieu ? `${lieu} · ` : ''}données au ${formatCourt(fin)} · mis à jour le ${maj}`;

  const rows = computeThresholds(series, { ...settings, refIso: fin });
  state.selected = seuilValide(rows, settings.direction);
  const ligne = rows.find((r) => r.threshold === state.selected);
  const crit = `${NOM_MESURE[settings.measure]} ${settings.direction === 'ge' ? '≥' : '≤'} ${formatTemp(ligne.threshold)}`;

  $('hero').replaceChildren(buildHero({
    titre: `Dernière fois que ${crit}`,
    threshold: ligne.threshold,
    direction: settings.direction,
    daysAgo: ligne.daysAgo,
    lastIso: ligne.lastIso,
    stats: ligne.lastIso
      ? [{ valeur: formatNombre(ligne.count365), libelle: 'jours sur 365' }, { valeur: ligne.avgPerYear < 0.05 ? '< 0,1' : formatDecimal(ligne.avgPerYear), libelle: 'jours par an en moyenne' }]
      : [],
  }));
  renderTable($('table-wrap'), rows, {
    sort: state.sort,
    selected: state.selected,
    direction: settings.direction,
    onSelect: (t) => {
      state.selected = t;
      saveSeuil(t);
      render();
      const zone = $('hero');
      if (zone.getBoundingClientRect().top < 0) zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  });

  renderYearSelect(series, fin);
  $('cal-meta').textContent = `${crit} · le seuil se choisit dans l'onglet Seuils`;
  const hits = renderHeatmap($('calendrier'), {
    series, year: state.year, measure: settings.measure, direction: settings.direction,
    threshold: state.selected, lastIso: ligne.lastIso ?? null,
  });
  renderCalResume(ligne, hits, crit);
}

function renderYearSelect(series, fin) {
  const sel = $('annee');
  const premiere = Number(series.start.slice(0, 4));
  const derniere = Number(fin.slice(0, 4));
  state.year = Math.min(Math.max(state.year, premiere), derniere);
  if (sel.options.length !== derniere - premiere + 1) {
    sel.replaceChildren();
    for (let y = derniere; y >= premiere; y--) sel.add(new Option(String(y), String(y)));
  }
  sel.value = String(state.year);
  $('annee-prec').disabled = state.year <= premiere;
  $('annee-suiv').disabled = state.year >= derniere;
}

function renderCalResume(ligne, hits, crit) {
  const el = $('cal-resume');
  el.replaceChildren();
  el.append(`${hits} jour${hits > 1 ? 's' : ''} en ${state.year} (${crit}). `);
  if (!ligne.lastIso) { el.append('Ce seuil n’a jamais été atteint.'); return; }
  const an = Number(ligne.lastIso.slice(0, 4));
  el.append(`Dernière fois : ${formatLong(ligne.lastIso)}. `);
  if (an !== state.year) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lien-annee';
    b.textContent = `Voir ${an}`;
    b.addEventListener('click', () => { state.year = an; render(); });
    el.append(b);
  }
}

/* ---------- Données ---------- */

function setProgress(p) {
  $('progression').hidden = p == null;
  if (p != null) {
    $('barre').value = Math.round(p * 100);
    $('progression-texte').textContent = `Téléchargement de l'historique… ${Math.round(p * 100)} %`;
  }
}

async function ouvrirVille(city, { force = false } = {}) {
  const token = ++state.token;
  state.city = city;
  saveLastCity(city);
  questions?.setDefaultCity(city);
  $('ville').value = cityLabel(city);
  showError('');

  const enCache = await readCached(city);
  if (token !== state.token) return;
  state.series = enCache;
  state.year = Number(todayUtcIso().slice(0, 4));
  render();
  if (!enCache) $('statut').textContent = `${cityLabel(city)} : téléchargement de l'historique…`;

  if (!force && !isStale(enCache)) return;
  $('rafraichir').disabled = true;
  if (!enCache || !enCache.tm) setProgress(0);
  try {
    const serie = await updateSeries(city, enCache, (p) => token === state.token && setProgress(p));
    if (token === state.token) { state.series = serie; render(); }
    majVillesMemo();
  } catch (e) {
    if (token === state.token) {
      showError(e instanceof ApiError ? e.message : 'Une erreur inattendue est survenue.');
      if (!enCache) $('statut').textContent = 'Aucune donnée pour cette ville pour le moment.';
    }
  } finally {
    if (token === state.token) { setProgress(null); $('rafraichir').disabled = false; }
  }
}

async function majVillesMemo() {
  let villes = [];
  try { villes = (await listCities()).filter((v) => v.tx?.length); } catch { /* ignore */ }
  const box = $('villes-memo');
  box.replaceChildren();
  villes.sort((a, b) => (b.updated || 0) - (a.updated || 0)).slice(0, 6).forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = v.name;
    b.title = cityLabel(v);
    b.addEventListener('click', () => ouvrirVille({ key: v.key, name: v.name, admin1: v.admin1, admin2: v.admin2, country: v.country, lat: v.lat, lon: v.lon }));
    box.append(b);
  });
  box.hidden = villes.length < 2;
}

/* ---------- Événements ---------- */

function initReglages() {
  const dlg = $('dlg-reglages');
  for (const [nom, val] of Object.entries(state.settings)) {
    const radio = dlg.querySelector(`input[name="${nom}"][value="${val}"]`);
    if (radio) radio.checked = true;
  }
  dlg.querySelectorAll('.seg input').forEach((r) => r.addEventListener('change', () => {
    state.settings = { ...state.settings, [r.name]: r.name === 'step' ? Number(r.value) : r.value };
    saveSettings(state.settings);
    render();
  }));
  $('reglages-btn').addEventListener('click', () => dlg.showModal());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // toucher le fond ferme la feuille
}

let questions = null;
function setView(view) {
  document.body.dataset.view = view;
  document.querySelectorAll('.tabbar [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.view === view)));
  window.scrollTo(0, 0);
  if (view === 'questions') questions?.poser();
}

function initOnglets() {
  document.querySelectorAll('.tabbar [role="tab"]').forEach((t) => t.addEventListener('click', () => setView(t.dataset.view)));
}

// Tri : « Dernière fois » commence par le plus récent.
const TRI_DEFAUT = { threshold: 'asc', lastIso: 'desc' };

function initTri() {
  const majSens = () => {
    const b = $('tri-sens');
    b.textContent = state.sort.dir === 'asc' ? '▲' : '▼';
    b.setAttribute('aria-label', state.sort.dir === 'asc' ? 'Ordre croissant (toucher pour inverser)' : 'Ordre décroissant (toucher pour inverser)');
  };
  $('tri').addEventListener('change', (e) => {
    state.sort = { key: e.target.value, dir: TRI_DEFAUT[e.target.value] };
    majSens();
    render();
  });
  $('tri-sens').addEventListener('click', () => {
    state.sort = { ...state.sort, dir: state.sort.dir === 'asc' ? 'desc' : 'asc' };
    majSens();
    render();
  });
  majSens();
}

function initAnnee() {
  $('annee').addEventListener('change', (e) => { state.year = Number(e.target.value); render(); });
  $('annee-prec').addEventListener('click', () => { state.year--; render(); });
  $('annee-suiv').addEventListener('click', () => { state.year++; render(); });
}

/* ---------- Service worker + mise à jour ---------- */

async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    const proposer = (worker) => {
      $('maj').hidden = false;
      $('maj-ok').onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
      $('maj-non').onclick = () => { $('maj').hidden = true; };
    };
    if (reg.waiting && navigator.serviceWorker.controller) proposer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) proposer(w);
      });
    });
    let recharge = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!recharge) { recharge = true; location.reload(); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  } catch { /* hors HTTPS ou navigateur sans support : l'app marche quand même */ }
}

/* ---------- Démarrage ---------- */

function main() {
  $('legende-barre').style.background = legendGradient();
  initReglages();
  initOnglets();
  initAnnee();
  initTri();
  initSearch({ input: $('ville'), list: $('suggestions'), onPick: (c) => ouvrirVille(c) });
  initTooltip($('calendrier'), $('infobulle'), () => state.series, () => ({ ...state.settings, threshold: state.selected }));
  questions = initQuestions({
    defaultCity: loadLastCity(), readCached, isStale, updateSeries, onStored: majVillesMemo,
  });
  $('rafraichir').addEventListener('click', () => state.city && ouvrirVille(state.city, { force: true }));
  initServiceWorker();
  majVillesMemo();
  render();
  const derniere = loadLastCity();
  if (derniere) ouvrirVille(derniere);
}
main();
