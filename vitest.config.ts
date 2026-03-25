import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  }
})
