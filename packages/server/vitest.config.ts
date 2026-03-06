import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
    },
  },
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',
        'src/db/migrate.ts',
        'src/types.ts',
        'src/terminal/worker-messages.ts',
        'src/db/schema/*.ts',
        'src/ast/rout-extractor.ts',
      ],
    },
  },
})
