-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('OFFICIAL', 'GAME_UPDATES', 'GTA_VI', 'COMMUNITY', 'INDUSTRY', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('COLLECTED', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "StreamerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('SUPPORT', 'REPORT', 'PARTNERSHIP', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('WARN', 'TIMEOUT', 'UNTIMEOUT', 'KICK', 'BAN', 'UNBAN', 'LOCK', 'UNLOCK');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('QUIZ', 'TOURNAMENT', 'LIVE_COMPETITION', 'SCREENSHOT_CHALLENGE', 'COMMUNITY_NIGHT');

-- CreateEnum
CREATE TYPE "EventParticipantStatus" AS ENUM ('REGISTERED', 'INTERESTED', 'ATTENDED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('MALAGASY', 'FRENCH', 'ENGLISH');

-- CreateEnum
CREATE TYPE "StatisticsPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "guild_configurations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT,
    "language" "Language" NOT NULL DEFAULT 'FRENCH',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Antananarivo',
    "commandPrefix" TEXT NOT NULL DEFAULT '/',
    "liveChannelId" TEXT,
    "newsChannelId" TEXT,
    "staffRoleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guild_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_configurations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "topic" TEXT,
    "position" INTEGER NOT NULL,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_configurations" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "hoist" BOOLEAN NOT NULL DEFAULT false,
    "mentionable" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'FRENCH',
    "platform" TEXT,
    "bio" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "member_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streamer_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "status" "StreamerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "platform" TEXT NOT NULL,
    "games" TEXT[],
    "language" "Language" NOT NULL,
    "channelUrl" TEXT,
    "introduction" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "streamer_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "voiceChannelId" TEXT NOT NULL,
    "stageChannelId" TEXT,
    "externalUrl" TEXT,
    "description" TEXT,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "hostId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "voiceAttendance" INTEGER NOT NULL DEFAULT 0,
    "announcementMessageId" TEXT,
    "discordScheduledEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,

    CONSTRAINT "live_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_schedules" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guestIds" TEXT[],
    "channelId" TEXT NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "discordScheduledEventId" TEXT,
    "registrationCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "subscribed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_statistics" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "period" "StatisticsPeriod" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "streamCount" INTEGER NOT NULL DEFAULT 0,
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uniqueStreamers" INTEGER NOT NULL DEFAULT 0,
    "totalAttendance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "live_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_articles" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "status" "NewsStatus" NOT NULL DEFAULT 'COLLECTED',
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "thumbnailUrl" TEXT,
    "sourceUrl" TEXT,
    "originalPublishedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "language" "Language" NOT NULL,
    "authorId" TEXT NOT NULL,
    "approverId" TEXT,
    "publisherId" TEXT,
    "announcementChannelId" TEXT,
    "announcementMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_revisions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_publications" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "news_publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_sources" (
    "id" TEXT NOT NULL,
    "guildId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "allowlisted" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastItemId" TEXT,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_submissions" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "submittedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "news_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_approvals" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "EventType" NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "discordScheduledEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventParticipantStatus" NOT NULL DEFAULT 'REGISTERED',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_badges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedBy" TEXT,

    CONSTRAINT "member_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "type" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "channelId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetType" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guild_configurations_guildId_key" ON "guild_configurations"("guildId");

-- CreateIndex
CREATE INDEX "channel_configurations_guildId_type_idx" ON "channel_configurations"("guildId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configurations_guildId_channelId_key" ON "channel_configurations"("guildId", "channelId");

-- CreateIndex
CREATE UNIQUE INDEX "role_configurations_guildId_roleId_key" ON "role_configurations"("guildId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "member_profiles_userId_key" ON "member_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "streamer_applications_userId_key" ON "streamer_applications"("userId");

-- CreateIndex
CREATE INDEX "streamer_applications_guildId_status_idx" ON "streamer_applications"("guildId", "status");

-- CreateIndex
CREATE INDEX "live_sessions_guildId_status_idx" ON "live_sessions"("guildId", "status");

-- CreateIndex
CREATE INDEX "live_sessions_hostId_idx" ON "live_sessions"("hostId");

-- CreateIndex
CREATE INDEX "live_sessions_startTime_idx" ON "live_sessions"("startTime");

-- CreateIndex
CREATE INDEX "live_participants_userId_idx" ON "live_participants"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "live_participants_sessionId_userId_key" ON "live_participants"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "live_schedules_guildId_status_idx" ON "live_schedules"("guildId", "status");

-- CreateIndex
CREATE INDEX "live_schedules_scheduledStart_idx" ON "live_schedules"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "live_notification_preferences_userId_key" ON "live_notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "live_statistics_guildId_period_startDate_key" ON "live_statistics"("guildId", "period", "startDate");

-- CreateIndex
CREATE INDEX "news_articles_guildId_status_idx" ON "news_articles"("guildId", "status");

-- CreateIndex
CREATE INDEX "news_articles_guildId_category_idx" ON "news_articles"("guildId", "category");

-- CreateIndex
CREATE INDEX "news_articles_sourceUrl_idx" ON "news_articles"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "news_publications_articleId_key" ON "news_publications"("articleId");

-- CreateIndex
CREATE INDEX "news_submissions_guildId_status_idx" ON "news_submissions"("guildId", "status");

-- CreateIndex
CREATE INDEX "events_guildId_status_idx" ON "events"("guildId", "status");

-- CreateIndex
CREATE INDEX "events_scheduledStart_idx" ON "events"("scheduledStart");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_eventId_userId_key" ON "event_participants"("eventId", "userId");

-- CreateIndex
CREATE INDEX "xp_transactions_guildId_userId_idx" ON "xp_transactions"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "badges_code_key" ON "badges"("code");

-- CreateIndex
CREATE UNIQUE INDEX "member_badges_userId_badgeId_key" ON "member_badges"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "warnings_guildId_userId_idx" ON "warnings"("guildId", "userId");

-- CreateIndex
CREATE INDEX "moderation_actions_guildId_userId_idx" ON "moderation_actions"("guildId", "userId");

-- CreateIndex
CREATE INDEX "moderation_actions_guildId_type_idx" ON "moderation_actions"("guildId", "type");

-- CreateIndex
CREATE INDEX "security_events_guildId_type_idx" ON "security_events"("guildId", "type");

-- CreateIndex
CREATE INDEX "security_events_guildId_createdAt_idx" ON "security_events"("guildId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_channelId_key" ON "tickets"("channelId");

-- CreateIndex
CREATE INDEX "audit_logs_guildId_createdAt_idx" ON "audit_logs"("guildId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- AddForeignKey
ALTER TABLE "channel_configurations" ADD CONSTRAINT "channel_configurations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_configurations" ADD CONSTRAINT "role_configurations_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streamer_applications" ADD CONSTRAINT "streamer_applications_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_participants" ADD CONSTRAINT "live_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_schedules" ADD CONSTRAINT "live_schedules_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_notification_preferences" ADD CONSTRAINT "live_notification_preferences_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_statistics" ADD CONSTRAINT "live_statistics_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_revisions" ADD CONSTRAINT "news_revisions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_publications" ADD CONSTRAINT "news_publications_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_publications" ADD CONSTRAINT "news_publications_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "news_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_sources" ADD CONSTRAINT "news_sources_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_submissions" ADD CONSTRAINT "news_submissions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_approvals" ADD CONSTRAINT "news_approvals_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "member_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_badges" ADD CONSTRAINT "member_badges_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "member_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "guild_configurations"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

