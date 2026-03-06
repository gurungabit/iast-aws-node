# AGENTS.md - Project Rules & Best Practices

## Project Overview

Node.js monorepo (`packages/web`, `packages/server`, `packages/shared`) for a TN3270 terminal automation platform. ESM-only (`"type": "module"`).

## Tech Stack

- **Server**: Fastify, Drizzle ORM (PostgreSQL), tnz3270-node, Zod, jose, Worker Threads
- **Web**: React 19, Vite, TanStack Router + Query, Zustand, Tailwind CSS v4, xterm.js, MSAL (Azure Entra ID)
- **Tooling**: TypeScript (strict), ESLint, Prettier, Vitest, Playwright

## Commands

| Task | Command |
|------|---------|
| Lint | `npm run lint` |
| Format | `npm run format` |
| Format check | `npm run format:check` |
| All tests | `npm test` |
| Server tests | `npm run test:server` |
| Web tests | `npm run test:web` |
| Coverage | `npm run test:coverage` |
| E2E tests | `npm run test:e2e` |
| Dev (all) | `npm run dev` |
| Dev (web only) | `npm run dev:web` |
| Dev (server only) | `npm run dev:server` |

## Mandatory Workflow

Every change MUST follow this sequence:

1. **Write/modify code**
2. **Write/update tests** - every new or changed file needs corresponding test coverage
3. **Run tests** - `npm test` must pass with 0 failures
4. **Run lint** - `npm run lint` must pass with 0 errors
5. **Verify coverage stays above 90%** - `npm run test:coverage` to check

Never submit code that breaks tests, introduces lint errors, or drops coverage below 90%.

## TypeScript Rules

- **Never use `any`** - not in source files, not in test files, nowhere
- **Never use `as unknown as`** casts - find a proper typed solution
- **Never create artificial interfaces** for testability (no `XxxLike`, `XxxDriver` wrappers around library types) - use `vi.mock()` in tests instead
- **Use `@ts-expect-error`** only for intentional type violations (e.g., testing error paths with invalid values)
- All imports use `.js` extension in server package (ESM resolution): `import { foo } from './bar.js'`
- Prefer `import type` for type-only imports

## Testing Rules

- **Framework**: Vitest for unit/integration, Playwright for E2E
- **Server tests**: `node` environment, files in `src/**/*.test.ts`
- **Web tests**: `jsdom` environment, files in `src/**/*.test.{ts,tsx}`
- **Mocking pattern**: Use `vi.mock('module-name', () => ({ ... }))` at top of test file, then `new MockedClass()` creates type-safe instances
- **Use `vi.hoisted()`** when mock variables are referenced inside `vi.mock()` factories
- **No `as any`** in test files - use proper types, `vi.fn()`, and `Object.assign(new MockedClass(), props)` for mock instances
- **Co-locate tests** next to source files: `foo.ts` + `foo.test.ts`
- Test files must not import test-only interfaces from source files

## React / Frontend Rules

- **No conditional hook calls** - all hooks must be called unconditionally; move conditions inside hooks or into variables checked after hooks
- **No `setState` inside `useEffect`** - derive state with `useMemo` or compute inline
- **No refs during render** - access `ref.current` only in effects or event handlers
- **Theme support required** - every UI element must have both light and dark variants: `bg-gray-50 dark:bg-zinc-900`, `border-gray-200 dark:border-zinc-800`, `text-gray-900 dark:text-zinc-100`
- **Never hardcode dark-only colors** (no bare `bg-gray-950`, `text-white`, `border-gray-800` without a light counterpart)
- **Cursor pointer on all clickable elements** - buttons, links, tabs, list items, anything interactive must have `cursor-pointer`
- **Custom components over native** - use custom DatePicker, not `<input type="date">`; use the component library in `src/components/ui/`
- Color pattern reference (from Navbar):
  - Background: `bg-gray-50 dark:bg-zinc-900`
  - Surface: `bg-white dark:bg-zinc-800`
  - Border: `border-gray-200 dark:border-zinc-800`
  - Text primary: `text-gray-900 dark:text-zinc-100`
  - Text secondary: `text-gray-500 dark:text-zinc-400`
  - Text muted: `text-gray-400 dark:text-zinc-600`
  - Hover: `hover:bg-gray-100 dark:hover:bg-zinc-800`
- **Status badges** must have light+dark variants:
  - Success: `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`
  - Error/failed: `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`
  - Warning/pending: `bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400`
  - Info/running: `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`
- **Empty states** should include an icon, primary message, and hint text - not just bare text
- **Page layouts** - list pages use `max-w-3xl mx-auto` centering with padding, not full-width edge-to-edge

## Server Rules

- Fastify with Zod validation via `fastify-type-provider-zod`
- Routes use Zod schemas for request/response validation
- Worker threads for TN3270 sessions (CPU-intensive work off main thread)
- Auth via Azure Entra ID JWT verification (jose library)
- Database: Drizzle ORM with PostgreSQL (postgres.js driver)

## Code Style

- **Clean, concise, modular code** - avoid duplications across the codebase
- **Keep it simple** - don't over-engineer, don't add features not asked for
- **No unnecessary abstractions** - three similar lines > premature helper function
- **No dead code** - delete unused code completely, no `// removed` comments
- **No backwards-compat hacks** - no renamed `_unused` vars, no re-exports of removed types
- **DRY principle** - extract shared logic only when the same code exists in 3+ places
- **Minimal comments** - only where logic isn't self-evident
- **Don't add docstrings/types/comments** to code you didn't change
- Prefer editing existing files over creating new ones
- Use `cn()` utility for conditional Tailwind classes

## File Structure

```
packages/
  server/src/
    ast/           # AST execution (runs in worker threads)
    auth/          # Entra ID auth hooks
    db/schema/     # Drizzle schema definitions
    routes/        # Fastify route handlers
    services/      # Business logic
    terminal/      # Worker thread management, WS handler, renderer
    integrations/  # External services (DB2, SMB, EventBridge)
  web/src/
    ast/           # AST forms, registry, components
    auth/          # MSAL auth guard and hooks
    components/    # Shared components (Navbar, ui/)
    config/        # API URLs, MSAL config
    hooks/         # Custom React hooks
    providers/     # Context providers
    routes/        # TanStack Router pages
    services/      # API client functions
    stores/        # Zustand stores
    terminal/      # Terminal component, session selector
    utils/         # Helpers
  shared/src/      # Shared types and utilities
```
