# Japplan

App perso (React + Capacitor) de suivi de voyages : carte interactive, planning par étape/par jour, liste d'activités. Principalement Android, mais aussi accessible depuis un navigateur (desktop, ou iOS) via une connexion Google Drive OAuth2.

Toutes les données de voyage vivent dans un fichier JSON unique sur Google Drive — rien n'est stocké dans ce dépôt. L'app détecte et fusionne automatiquement les changements concurrents entre les quelques personnes qui partagent un voyage. Voir [CLAUDE.md](CLAUDE.md) pour l'architecture complète.

## Setup

```bash
npm install
npm run dev
```

## Connexion Google Drive (accès navigateur)

Le build web a besoin d'un projet Google Cloud pour s'authentifier et accéder au fichier de voyages sur Drive.

1. [console.cloud.google.com](https://console.cloud.google.com) → créer/sélectionner un projet.
2. **APIs & Services > Library** → activer **Google Drive API** et **Google Picker API**.
3. **APIs & Services > Google Auth Platform** → assistant de démarrage (type **External**) → une fois créé, dans l'onglet **Audience**, passer le statut de publication sur **"In production"** (reste non-vérifié, évite juste l'expiration des tokens à 7 jours du mode Test).
4. **Google Auth Platform > Clients** (ou **APIs & Services > Credentials**) → *Create Credentials* → **OAuth client ID** :
   - Type : **Web application**
   - Authorized JavaScript origins : `http://localhost:5173` **et** `https://pierredamienc.github.io` (l'origine de prod GitHub Pages — voir "Déploiement web" ci-dessous ; l'origine ne prend pas le sous-chemin `/japplan`)
5. *Create Credentials* → **API key**, puis "Restrict key" :
   - Application restrictions (HTTP referrers) : `http://localhost:5173/*`, `https://pierredamienc.github.io/*` **et** `https://docs.google.com/*` (le Picker s'affiche dans un iframe hébergé sur `docs.google.com` — sans cette entrée, erreur "The API developer key is invalid")
   - API restrictions : **Google Picker API** et **Google Drive API**
6. Noter le **numéro de projet** (page d'accueil du projet — différent de l'ID projet), requis par le Picker pour le scope `drive.file`.
7. Copier [.env.local.example](.env.local.example) en `.env.local` et renseigner les 3 valeurs.

Détails des pièges rencontrés (popups bloqués, port qui dérive, etc.) : voir la section "Known pitfalls" de [CLAUDE.md](CLAUDE.md).

## Déploiement web (GitHub Pages)

Le build web (accès depuis un navigateur desktop/iOS) est déployé sur GitHub Pages à chaque push sur `main`, via `.github/workflows/deploy-pages.yml` — `npm run build:pages` (mode `gh-pages`, base path `/japplan/`) puis publication du contenu de `dist/`.

Prérequis, à faire une fois :

1. **Repo → Settings → Pages → Build and deployment → Source : "GitHub Actions"** (au lieu de "Deploy from a branch").
2. **Repo → Settings → Secrets and variables → Actions → onglet "Repository secrets"** (pas "Environments" — le job `build` du workflow ne déclare pas d'environnement, seul `deploy` déclare `github-pages`, donc un secret scopé à cet environnement serait invisible du job qui en a besoin) : ajouter les 3 secrets `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_PROJECT_NUMBER` (mêmes valeurs que `.env.local`).
3. Enregistrer l'origine `https://pierredamienc.github.io` côté Google Cloud Console (étapes 4-5 ci-dessus) — sans ça, l'auth échoue avec `Erreur 401: invalid_client`.

Tant que l'écran de consentement OAuth reste en statut **"Testing"**, seuls les comptes Google explicitement ajoutés comme "Test users" (Google Auth Platform → Audience) peuvent se connecter sur le site déployé — passer en **"In production"** (étape 3 ci-dessus) lève cette limite en plus de celle des refresh tokens à 7 jours.

## Commandes

```bash
npm run dev              # serveur de dev Vite
npm run build             # tsc -b && vite build
npm run lint               # oxlint
npx cap sync android       # copie le build web dans le projet Android natif
npm run deploy               # build web + sync + gradlew assembleDebug + install/lancement sur le téléphone connecté
```

Détails complets (build Android, import CSV, carte hors-ligne...) : voir [CLAUDE.md](CLAUDE.md).
