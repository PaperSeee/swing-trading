# Backtest Journal (Sessions + Trades)

Application Next.js pour backtester par session.

Chaque session contient:
- une paire (ex: EURUSD)
- un mois + une année

Chaque trade contient:
- date
- sens (`long` ou `short`)
- résultat (`win`, `lose`, `be`)
- valeur en R
- notes
- image/chart URL

Les données sont stockées dans Supabase.

## 1) Installation

```bash
npm install
```

## 2) Configurer Supabase

1. Crée un projet Supabase.
2. Va dans SQL Editor et exécute le script [supabase/schema.sql](supabase/schema.sql).
3. Copie `.env.example` vers `.env.local` puis remplis:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 3) Lancer en local

```bash
npm run dev
```

Puis ouvre http://localhost:3000

## 4) Déployer sur Vercel

1. Push le repo sur GitHub.
2. Import le repo dans Vercel.
3. Ajoute les variables d'environnement dans Vercel:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
4. Déploie.

## Notes

- Cette version est MVP sans authentification.
- La clé `SUPABASE_SERVICE_ROLE_KEY` reste côté serveur via les routes API Next.js.
