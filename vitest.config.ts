import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@/src': new URL('./src', import.meta.url).pathname,
    },
  },
})
