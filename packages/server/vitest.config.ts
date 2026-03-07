import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@src': new URL('./src/', import.meta.url).pathname,
    },
    root: new URL('./', import.meta.url).pathname,
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
