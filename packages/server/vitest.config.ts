import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.ts',
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
