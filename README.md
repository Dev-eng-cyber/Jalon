# Jalon : application React + Supabase

## Lancer en local
1. Installer Node.js 20 ou plus récent (nodejs.org).
2. Dans ce dossier : `npm install`
3. Copier `.env.example` en `.env` et remplir :
   - `VITE_SUPABASE_URL` : Project Settings > API > Project URL
   - `VITE_SUPABASE_ANON_KEY` : la clé publique (anon / publishable). Jamais la clé service_role.
4. `npm run dev` puis ouvrir http://localhost:5173

## Comptes de test (créés avec le script de démonstration)
- votre compte administrateur
- chef@jalon.test, membre@jalon.test, externe@jalon.test (mot de passe choisi lors de la création)

## Structure
- `src/lib` : client Supabase, formats, reçu PDF
- `src/context` : authentification et profil
- `src/components` : coquille de l'application, intro animée, logo
- `src/pages` : landing, connexion, tableau de bord, tâches, catalogue, finances
- `src/styles/app.css` : design repris de la maquette

## Mise en ligne (gratuit)
`npm run build` génère le dossier `dist/`, à déployer sur Netlify, Vercel ou Cloudflare Pages
(règle de réécriture vers index.html pour toutes les routes). Ajoutez ensuite l'adresse du site dans
Supabase > Authentication > URL Configuration (Site URL et Redirect URLs).
