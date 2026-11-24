import pino from 'pino'
import { config } from '../config/index.js'

/**
 * Structured logger. Pretty-printed in development, silent in tests,
 * JSON-friendly in production (hook up a log drain there).
 */
export const logger = pino(
  config.NODE_ENV === 'test'
    ? { level: 'silent' }
    : {
        level: config.LOG_LEVEL,
        transport:
          config.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: ['pid', 'hostname'] },
              },
      }
)
