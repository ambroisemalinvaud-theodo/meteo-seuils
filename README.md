# Seuils météo

Web app installable (PWA) qui montre, pour une ville, la dernière fois qu'une température seuil a été atteinte (tableau + calendrier annuel). Données : [Open-Meteo](https://open-meteo.com/) (gratuit, sans clé, 1940 → aujourd'hui). Aucun backend, aucune donnée personnelle collectée : tout se passe dans le navigateur.

## Lancer en local (Mac)

```bash
cd meteo-seuils
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000> dans le navigateur. Arrêter le serveur : `Ctrl + C`.

**Depuis l'iPhone (même Wi-Fi)** : trouver l'adresse du Mac (`ipconfig getifaddr en0`), puis ouvrir `http://<adresse>:8000` dans Safari. Cela permet de voir la mise en page, mais le service worker et l'installation PWA exigent du HTTPS (sauf sur `localhost`) : l'installation définitive se fait après l'hébergement.

## Tests

```bash
node tests/run-node.mjs
```

Ou ouvrir `tests/tests.html` via le serveur local (<http://localhost:8000/tests/tests.html>).

## Modifier l'app puis la mettre à jour sur le téléphone

1. Modifier les fichiers.
2. Dans `sw.js`, changer `VERSION` (`'v1'` → `'v2'`…). Sans cela, le téléphone garde l'ancienne version en cache.
3. Publier (`git add -A && git commit -m "…" && git push`). À l'ouverture suivante, l'app propose « Mettre à jour ».

## Publier sur GitHub Pages

Dépôt public, branche `main`, dossier racine `/` (Settings → Pages). Les chemins étant relatifs, l'app fonctionne dans un sous-dossier (`https://<compte>.github.io/meteo-seuils/`).

## Installer

- **iPhone** : ouvrir l'URL dans Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Mac** : dans Safari, Fichier → « Ajouter au Dock ».

## Limites

Les valeurs viennent d'une réanalyse (modélisation sur grille) et peuvent différer de quelques degrés d'une station officielle. Le dernier jour (aujourd'hui) peut être une prévision.
