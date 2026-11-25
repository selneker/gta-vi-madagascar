# GTA VI MADAGASCAR — Discord Live Center & Newsroom

Bot Discord pour la communauté **GTA VI Madagascar** : Live Center, Newsroom,
profils membres, tickets, suggestions, rôles auto-assignables et provisionnement
automatique de la structure du serveur.

Interface trilingue : malagasy, français, anglais.

## Fonctionnalités

- **Live Center** — n'importe quel membre ayant le rôle auto-assignable
  **Streamer** peut démarrer un live (`/live start`). Les salons vocaux sont
  ouverts à `@everyone` (connexion, parole, partage d'écran).
- **Join-to-Create** — rejoindre le salon `🔴・CREATE YOUR LIVE ROOM` crée un
  salon vocal temporaire `PUBLIC N`, supprimé dès qu'il est vide.
- **Newsroom** — soumission, revue, approbation et publication d'articles GTA VI,
  avec flux RSS.
- **Communauté** — profils, tickets, suggestions, événements, classement XP.
- **Provisionnement** — `/setup preview|apply|audit|cleanup` aligne rôles,
  catégories et salons sur `src/config/server.ts` (idempotent).
- **Santé** — `GET /health` renvoie `200` quand la passerelle Discord est
  connectée, `503` sinon.

## Prérequis

- Node.js **22.12+**
- Une base PostgreSQL (Neon, Supabase, local…)
- Une application Discord avec un bot

## Configuration Discord

1. Créez l'application sur <https://discord.com/developers/applications>.
2. **Bot → Privileged Gateway Intents** : activez **Server Members Intent**
   (nécessaire pour l'accueil des nouveaux membres).
3. Invitez le bot avec les scopes `bot` + `applications.commands` et les
   permissions `Administrator` (le provisionnement crée et déplace des salons).
4. Renseignez `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` et `DISCORD_GUILD_ID`.

## Installation

```bash
git clone https://github.com/<votre-compte>/gta-vi-madagascar.git
cd gta-vi-madagascar
npm ci
cp .env.example .env        # puis remplir les valeurs
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

Les commandes slash sont enregistrées automatiquement au démarrage
(`ClientReady`). Le script `npx tsx scripts/register-commands.ts` reste
disponible pour forcer un enregistrement manuel.

## Variables d'environnement

| Variable | Requis | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | oui | Token du bot |
| `DISCORD_CLIENT_ID` | oui | Application ID |
| `DISCORD_GUILD_ID` | oui | Serveur cible |
| `DISCORD_GLOBAL_COMMANDS` | non | `true` pour des commandes globales |
| `DATABASE_URL` | oui | URL PostgreSQL |
| `PORT` | non | Port du serveur `/health` (injecté par Render) |
| `LOG_LEVEL` | non | `fatal`…`trace` (défaut `info`) |
| `TIMEZONE` | non | Défaut `Africa/Antananarivo` |

## Provisionnement du serveur

```text
/setup preview     # montre ce qui serait créé / modifié
/setup apply       # applique (idempotent)
/setup audit       # rapport complet
/setup cleanup dry-run:true    # montre les doublons (défaut)
/setup cleanup dry-run:false   # supprime réellement les doublons
```

`cleanup` ne supprime jamais un salon inconnu de la configuration ni un salon
contenant des messages. Les catégories en double sont fusionnées : leurs enfants
sont déplacés vers la catégorie conservée avant suppression.

## Rôles

- **Streamer** — auto-assignable, permet `/live start` et le partage d'écran.
- **Verified Streamer** — badge attribué après revue d'une candidature
  (`/streamer apply`).
- Les rôles de langue, plateforme et **Live Alerts** sont auto-assignables via
  le sélecteur du message d'accueil.

## Développement

```bash
npm run dev
npm test          # vitest
npx tsc --noEmit  # vérification des types
```

## Déploiement

Le dépôt contient un `Dockerfile` et un `docker-compose.yml`. Sur Render, le
runtime Node natif fonctionne également :

- Build : `npm ci && npx prisma generate && npm run build`
- Start : `npm start`
- Health check : `/health`

## Licence

Distribué sous **GNU Affero General Public License v3.0**. Voir [`LICENSE`](./LICENSE).
