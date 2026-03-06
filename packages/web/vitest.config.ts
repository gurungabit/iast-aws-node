import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    root: resolve(__dirname),
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/routeTree.gen.ts',
        'src/main.tsx',
        'src/test-setup.ts',
        'src/components/ui/index.ts',
        'src/routes/**/*.tsx',
      ],
    },
  },
})
