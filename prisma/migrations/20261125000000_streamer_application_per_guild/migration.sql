-- Streamer applications are scoped per guild: one application per user per guild.
DROP INDEX "streamer_applications_userId_key";

CREATE UNIQUE INDEX "streamer_applications_guildId_userId_key" ON "streamer_applications"("guildId", "userId");
