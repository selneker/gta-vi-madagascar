import { GtaMadagascarBot } from './client.js'
import { config } from './config/index.js'
import { startHealthServer } from './health.js'
import { logger } from './lib/logger.js'

const bot = new GtaMadagascarBot()
let shuttingDown = false

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Arrêt du bot / Shutting down')
  try {
    await bot.stop()
    logger.info('Arrêt terminé / Shutdown complete')
  } catch (error) {
    logger.error({ error: String(error) }, 'Erreur pendant l\'arrêt / Error during shutdown')
  }
  process.exit(0)
}

async function main(): Promise<void> {
  // Bind the platform-provided port first so the service is reported live
  // while Discord login and command registration are still in progress.
  startHealthServer()
  await bot.start(config.DISCORD_TOKEN)
}

main().catch((error) => {
  logger.error({ error: String(error) }, 'Échec fatal / Fatal error')
  process.exit(1)
})

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ error: String(reason) }, 'Rejet non géré / Unhandled rejection')
})
