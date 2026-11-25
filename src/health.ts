import { createServer } from 'node:http'
import { logger } from './lib/logger.js'

export type GatewayStatus = 'starting' | 'ready' | 'connecting' | 'disconnected'

let gatewayStatus: GatewayStatus = 'starting'

/** Called by the Discord client events so /health reflects the real gateway state. */
export function setGatewayStatus(status: GatewayStatus): void {
  gatewayStatus = status
}

export function getGatewayStatus(): GatewayStatus {
  return gatewayStatus
}

/**
 * Minimal HTTP health endpoint. The bot itself is Discord-only, but hosting
 * platforms (Render, Kubernetes, Docker) expect the process to bind a port so
 * they can mark the service live and probe its health.
 *
 * Listens on $PORT when set (Render injects it); does nothing otherwise.
 * Returns 503 while the gateway is not connected, so a deploy that cannot reach
 * Discord is not reported as healthy.
 */
export function startHealthServer(port = Number(process.env.PORT ?? 0)): void {
  if (!Number.isInteger(port) || port <= 0) {
    logger.info('PORT not set — health endpoint disabled')
    return
  }

  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const healthy = gatewayStatus === 'ready'
      res.writeHead(healthy ? 200 : 503, { 'content-type': 'application/json' })
      res.end(
        JSON.stringify({
          status: healthy ? 'ok' : 'degraded',
          gateway: gatewayStatus,
          uptime: process.uptime(),
        })
      )
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
