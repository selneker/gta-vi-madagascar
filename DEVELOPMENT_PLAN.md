# GTA VI MADAGASCAR — Development Plan

**Project:** GTA VI MADAGASCAR Discord community ecosystem
**Tagline:** ONE ISLAND. ONE COMMUNITY. ONE WORLD.
**Stack:** Node.js LTS (22), TypeScript, discord.js v14, Prisma ORM, PostgreSQL, Redis (optional), Docker, Vitest
**Timezone:** Africa/Antananarivo (all user-facing times)
**Languages:** Malagasy, French, English

## Phase 1 — Foundation (in progress)
- [x] Repository initialized (TypeScript, git, package.json, tsconfig, Prisma schema)
- [ ] Environment template (.env.example) + Docker Compose (PostgreSQL + Redis)
- [ ] Prisma client generated; schema validated with `prisma validate`
- [ ] Centralized config module with validation (Zod) and structured logging (pino)
- [ ] Discord.js client skeleton: login, intents, graceful shutdown, health check
- [ ] Slash-command registry (guild-scoped commands for fast iteration)
- [ ] CI-style verification: `tsc --noEmit` passes, vitest suite green

## Phase 2 — Server Setup
- [ ] Configuration-driven channel/role definitions (all categories/channels/roles from the brief)
- [ ] `/setup preview` — dry-run diff of current guild vs desired config
- [ ] `/setup apply` — idempotent creation/updates (no duplicates, never delete unknown channels)
- [ ] `/setup audit` — permission hierarchy and channel/role drift report
- [ ] Community server requirements check (Stage + Announcement channels)
- [ ] Welcome/onboarding flow (#welcome, #rules, #verify, role selection)

## Phase 3 — Live Center (highest priority)
- [ ] Stage Voice Channel + two Stream Rooms: native permissions
- [ ] `/live panel`, `/live start` (modal), `/live end`, `/live schedule`, `/live cancel`, `/live list`, `/live status`, `/live history`
- [ ] LiveSession persistence, announcement embeds, Live Alerts opt-in role notifications
- [ ] `/streamer apply / approve / reject / profile / leaderboard` + reputation system
- [ ] LIVE CENTER lobby → temporary voice rooms (owner controls, auto-delete when empty)
- [ ] Live Calendar via Discord Scheduled Events, reminders, Africa/Antananarivo time
- [ ] Live content archive (#live-clips), weekly/monthly statistics

## Phase 4 — Newsroom (highest priority)
- [ ] News source manager (RSS / approved APIs / manual), allowlist, duplicate fingerprints
- [ ] `/news submit / review / approve / reject / publish / edit / sources / history / archive`
- #gta-news announcement channel (read-only for members), #news-discussion
- [ ] Approval workflow: COLLECTED → PENDING REVIEW → APPROVED → PUBLISHED → ARCHIVED
- [ ] Preview before publication, embed styling, confirmation badges, edit history (NewsRevision)
- [ ] Background news-processing service with persistent jobs (survives restart, no in-memory-only timers)

## Phase 5 — Community
- [ ] Member profiles (language, platform, badges, level, live/event history)
- [ ] XP system with anti-farming, ranking, leaderboards
- [ ] Events: quizzes, tournaments, screenshot challenges, community nights; registration
- [ ] Ticket system (support/reports/partnerships/technical)
- [ ] Suggestion system (submission, voting, approval, implementation tracking)

## Phase 6 — Security
- [ ] Moderation commands: /warn /warnings /timeout /untimeout /kick /ban /unban /report /modlogs /lock /unlock
- [ ] Anti-spam, anti-flood, anti-raid, anti-mention-spam, suspicious links, duplicate messages
- [ ] Audit logging, staff notifications, server-side permission checks on every sensitive command
- [ ] No automatic bans on uncertain signals

## Phase 7 — Integration
- [ ] End-to-end flows: streamer apply → approve → /live start → announcement → /live end → history
- [ ] News: submit → review → approve → publish → #gta-news → discussion
- [ ] Fix integration problems across Live Center, Newsroom, moderation, XP

## Phase 8 — Documentation & Deployment
- [ ] Deployment instructions, backup/restore procedures, env variable reference
- [ ] Discord permissions required, Developer Portal instructions
- [ ] Server initialization commands
- [ ] Remaining manual configuration list
- [ ] Definition of Done review (bot connects, server configurable, permissions work, tests pass)

## Definition of Done (gate before calling complete)
- Bot connects to Discord; server structure provisionable safely
- All required categories/channels exist with correct native types
- Stage + voice permissions work; authorized streamers can run the Live system
- Live announcements, scheduling, persistence all work
- News submission/review/publication protected by permissions; duplicates prevented
- Moderation functional; migrations work; critical automated tests pass
- Documentation complete; deployment prepared
- Never claim production-ready unless critical features are tested
