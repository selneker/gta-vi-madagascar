# GTA VI MADAGASCAR — Development Progress

**Status:** Phase 1 — Foundation (started 2026-11-24)
**Working directory:** /home/selneker/Projects/gta-vi-madagascar
**Git:** initialized, empty (no commits yet)

## Milestones

| Phase | Milestone | Status | Notes |
|-------|-----------|--------|-------|
| 1 | Repo + TS + git + package.json + tsconfig | Done | lint/strict TS, Node ≥22 |
| 1 | Prisma schema (26 models, all section-10 entities) | Done | valid, Prisma client generated |
| 1 | .env.example + docker-compose.yml + Dockerfile | Done | Postgres 16 + Redis 7 optional |
| 1 | vitest config + tests/setup-env.ts | Done | tests/ included |
| 1 | DEVELOPMENT_PLAN.md / DEVELOPMENT_PROGRESS.md | Done | this file |
| 1 | npm install, `tsc --noEmit`, `vitest run` green | Done | 14 tests pass, 0 fail |
| 1 | Config module (Zod), pino logger, Prisma client singleton | Done | env validation at import |
| 1 | Discord.js client + intents + graceful shutdown | Done | Guilds, Members, Messages, MessageContent, VoiceStates, ScheduledEvents |
| 1 | Slash-command registry + /setup (preview/apply/audit) | Done | admin-only, idempotent provisioning |
| 2 | Config-driven server setup (/setup preview/apply/audit) | Done | code complete; needs a guild + token to run against |
| 3 | Live Center commands + persistence | Pending | schema ready, commands not yet written |
| 4 | Newsroom workflow + background service | Done | /news submit/review/approve/reject/publish/edit/sources/history/archive commands + news-center service + news-announcements service |
| 5 | Community: profiles, XP, events, tickets, suggestions | Done | /community profile/event/ticket/suggest commands + community-center service |
| 6 | Security + moderation | Pending | schema ready, commands not yet written |
| 7 | Integration tests | Pending | |
| 8 | Documentation + deployment | Pending | |

## Notes
- Discord is not reachable from this environment; no bot token or guild ID has been provided. The bot code is written to be configured entirely via environment variables. Do not invite the bot to a production server without authorization.
- Docker is not installed locally; docker-compose.yml is deployment preparation only.
- The local `agent-discord-skills` plugin exists at ~/.claude/skills/agent-discord-skills but requires a Discord bot token and targets live guilds directly — it is not part of this bot build and is not used here.
- Dynamic public voice channels (Join-to-Create): `src/events/voice-state.ts` reuses the existing lobby `🔴・CREATE YOUR LIVE ROOM` and, when a member joins it, creates `PUBLIC 1`, `PUBLIC 2`, … (smallest free number, atomic under concurrency via a creation lock), opens them to @everyone (VIEW_CHANNEL/CONNECT/SPEAK/USE_VAD/STREAM), moves the member in, registers them in `channelConfiguration`, and auto-deletes them when empty after 5 minutes (number released for reuse). Restart recovery re-adopts existing `PUBLIC N` channels. Tests: simultaneous creation, permissions, empty/occupied cleanup, restart recovery (8 tests).
