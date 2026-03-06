import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['packages/*/src/**/*.{ts,tsx}'],
      exclude: [
        'packages/*/src/**/*.d.ts',
        'packages/web/src/routeTree.gen.ts',
        'packages/web/src/main.tsx',
        'packages/server/src/index.ts',
        'packages/server/src/db/migrate.ts',
      ],
    },
  },
})
