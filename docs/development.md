# Development Guide

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)
- npm 10+ (ships with Node.js 20)

## Repository Structure

```
iast-aws-node/
├── docs/                          # Documentation (you are here)
├── docker-compose.yml             # Local PostgreSQL
├── package.json                   # Root monorepo config
├── tsconfig.base.json             # Shared TypeScript settings
├── eslint.config.js               # Linting
├── .prettierrc                    # Formatting
├── vitest.workspace.ts            # Test workspace config
├── playwright.config.ts           # E2E test config
│
└── packages/
    ├── shared/                    # Shared types & utilities
    │   └── src/
    │       ├── index.ts           # Barrel export
    │       ├── ast.ts             # AST types (ASTName, ASTStatus, ASTParams, etc.)
    │       ├── auth.ts            # Auth types
    │       ├── auto-launchers.ts  # AutoLauncher types
    │       ├── config.ts          # Config types
    │       ├── errors.ts          # Error codes
    │       ├── messages.ts        # Browser <-> Server WS messages
    │       ├── worker-messages.ts # Main thread <-> Worker messages
    │       └── utils.ts           # Shared utilities
    │
    ├── server/                    # Backend (Fastify)
    │   ├── src/
    │   │   ├── index.ts           # Entry point
    │   │   ├── app.ts             # Fastify setup
    │   │   ├── config.ts          # Env config (Zod validated)
    │   │   ├── auth/              # Entra ID JWT verification
    │   │   ├── db/                # Drizzle ORM schema & client
    │   │   ├── routes/            # REST API endpoints
    │   │   ├── services/          # Business logic
    │   │   ├── terminal/          # Worker thread management & WS bridging
    │   │   ├── ast/               # AST implementations (run in workers)
    │   │   └── integrations/      # DB2, SMB, EventBridge, Secrets Manager
    │   └── tests/                 # Server tests
    │
    └── web/                       # Frontend (React + Vite)
        ├── src/
        │   ├── main.tsx           # App entry
        │   ├── routes/            # TanStack Router pages
        │   ├── stores/            # Zustand state
        │   ├── hooks/             # Custom hooks
        │   ├── services/          # API communication
        │   ├── terminal/          # xterm.js components
        │   ├── ast/               # AST registry, forms, components
        │   ├── auth/              # MSAL integration
        │   ├── components/        # Shared UI components
        │   ├── providers/         # React context providers
        │   ├── config/            # Frontend configuration
        │   └── utils/             # Utility functions
        └── tests/                 # Web tests
```

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd iast-aws-node
npm install

# Start local PostgreSQL
npm run docker:up

# Configure environment
cp packages/server/.env.example packages/server/.env
# Edit .env with your values (Entra IDs, encryption key, etc.)

# Run database migrations
npm -w packages/server run db:migrate

# Start development
npm run dev
```

This starts both servers concurrently:
- **Web:** http://localhost:5173 (Vite dev server with HMR)
- **Server:** http://localhost:3000 (Fastify with hot reload)
- **Swagger:** http://localhost:3000/docs

## npm Scripts

### Root level

| Script | Description |
|--------|-------------|
| `npm run dev` | Start web + server concurrently |
| `npm run dev:web` | Start web only |
| `npm run dev:server` | Start server only |
| `npm run build:web` | Production build web |
| `npm run build:server` | Production build server |
| `npm run lint` | ESLint all packages |
| `npm run format` | Prettier format all |
| `npm run format:check` | Check formatting |
| `npm test` | Run all tests (server + web) |
| `npm run test:server` | Server tests only |
| `npm run test:web` | Web tests only |
| `npm run test:coverage` | Tests with coverage |
| `npm run test:e2e` | Playwright E2E tests |
| `npm run docker:up` | Start PostgreSQL container |
| `npm run docker:down` | Stop PostgreSQL |
| `npm run docker:reset` | Reset PostgreSQL (delete volume) |

## Testing

### Framework

- **Unit/Integration:** Vitest
- **Component testing:** @testing-library/react
- **E2E:** Playwright

### Configuration

Tests live in `tests/` directories (not alongside source in `src/`):

```
packages/server/tests/     # Server tests
packages/web/tests/         # Web component & unit tests
```

Both packages use `@src` path alias to import from `src/`:
```typescript
import { Session } from '@src/ast/session.js'  // resolves to src/ast/session.js
```

### Running Tests

```bash
# All tests
npm test

# Watch mode (web)
npm run test:watch

# Single test file
npx vitest run tests/ast/session.test.ts

# With coverage report
npm run test:coverage
```

### Test Count

| Package | Test Files | Tests |
|---------|-----------|-------|
| Server | 43 | 670 |
| Web | 52 | 528 |
| **Total** | **95** | **1198** |

### Mocking Conventions

Server tests use `vi.mock()` with `@src` paths:
```typescript
vi.mock('@src/auth/entra.js', () => ({
  verifyEntraToken: vi.fn(),
}))
```

Web tests mock stores, services, and external modules:
```typescript
vi.mock('@src/stores/session-store', () => ({
  useSessionStore: vi.fn((selector) => selector(mockState)),
}))
```

## Code Style

- **TypeScript strict mode** across all packages
- **ESLint** with React hooks plugin
- **Prettier** for formatting (single quotes, no semicolons, 100 print width)
- **Path aliases:** `@src` maps to `src/` in both packages
- **File extensions:** Server imports use `.js` extension (ESM convention)

## Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Worker threads (not child processes) | Lower overhead, shared memory, better for I/O-bound TN3270 sessions |
| Monorepo with npm workspaces | Shared types, single dependency tree, coordinated versioning |
| Zustand (not Redux) | Simpler API, smaller bundle, per-tab state selectors |
| TanStack Router (not React Router) | File-based routing, type-safe params, built-in search params |
| Drizzle ORM (not Prisma) | SQL-first approach, no code generation step, smaller runtime |
| Fastify (not Express) | Native TypeScript, schema validation, WebSocket plugin, faster |
| xterm.js (not custom terminal) | Industry-standard terminal emulator, handles ANSI rendering |

## Adding a New AST

1. **Shared types** (`packages/shared/src/ast.ts`):
   - Add name to `ASTName` union type

2. **Server implementation** (`packages/server/src/ast/`):
   - Create `new-ast.ts` with the AST function
   - Register in `executor.ts` dispatch

3. **Frontend form** (`packages/web/src/ast/new-ast/`):
   - Create `NewASTForm.tsx` component
   - Create `register.ts` with `registerAST()` call
   - Import register file in root layout

4. **Tests**:
   - Server: `tests/ast/new-ast.test.ts`
   - Web: `tests/ast/new-ast/NewASTForm.test.tsx`

## Debugging

### Server-side

Fastify logs to stdout in JSON format. Set `LOG_LEVEL=debug` for verbose output.

Worker thread console output appears in the main process stdout.

### WebSocket messages

Open browser DevTools Network tab, filter by WS. Click the WebSocket connection to see frames.

### TN3270 screen debugging

The `screen` message includes full ANSI output. To see raw screen data, log the `ansi` field in the worker's screen update handler.

### Database

```bash
# Connect to local PostgreSQL
docker exec -it iast-aws-node-postgres-1 psql -U iast -d iast

# Useful queries
SELECT * FROM executions ORDER BY started_at DESC LIMIT 10;
SELECT count(*) FROM policy_results WHERE execution_id = 'exec_123';
SELECT * FROM users;
```
