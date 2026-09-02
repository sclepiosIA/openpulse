import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/config/**/*.contract.test.ts'],
    retry: 0,
  },
})
