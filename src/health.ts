import { createServer } from 'node:http'
import { logger } from './lib/logger.js'

/**
 * Minimal HTTP health endpoint. The bot itself is Discord-only, but hosting
 * platforms (Render, Kubernetes, Docker) expect the process to bind a port so
 * they can mark the service live and probe its health.
 *
 * Listens on $PORT when set (Render injects it); does nothing otherwise.
 */
export function startHealthServer(port = Number(process.env.PORT ?? 0)): void {
  if (!Number.isInteger(port) || port <= 0) {
    logger.info('PORT not set — health endpoint disabled')
    return
  }

  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.on('error', (error) => {
    logger.error({ error: String(error) }, 'Health server error')
  })

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, 'Health endpoint listening on /health')
  })
}
