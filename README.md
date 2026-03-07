# IAST AWS Node

TN3270 terminal automation platform built as a Node.js monorepo. Connects to IBM mainframes via TN3270, runs automated screen tasks (ASTs), and provides a web UI for real-time monitoring and control.

## Architecture

```mermaid
graph TB
    subgraph Browser["Browser (React SPA)"]
        UI[Web UI]
        XTerm[xterm.js Terminal]
        WS_Client[WebSocket Client]
    end

    subgraph Server["Fastify Server (Main Thread)"]
        HTTP[HTTP Routes]
        WS_Handler[WS Handler]
        Auth[Entra ID Auth]
        DB_Client[Drizzle ORM]
        TM[TerminalManager]
    end

    subgraph Workers["Worker Threads"]
        W1[Worker 1: Session A]
        W2[Worker 2: Session B]
        WN[Worker N: Session Z]
    end

    subgraph External["External Services"]
        PG[(PostgreSQL)]
        MF[IBM Mainframe]
    end

    UI --> WS_Client
    XTerm --> WS_Client
    WS_Client <-->|WebSocket| WS_Handler
    UI -->|REST API| HTTP
    HTTP --> Auth
    HTTP --> DB_Client
    WS_Handler --> TM
    TM --> W1
    TM --> W2
    TM --> WN
    W1 <-->|TN3270| MF
    W2 <-->|TN3270| MF
    WN <-->|TN3270| MF
    DB_Client --> PG
    WS_Handler --> DB_Client
```

## AST Execution Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant WS as WS Handler
    participant W as Worker Thread
    participant MF as Mainframe
    participant DB as PostgreSQL

    B->>WS: ast.run { astName, params }
    WS->>DB: Create execution record
    WS->>W: ast.run + executionId

    loop For each policy
        W->>MF: Navigate screens (TN3270)
        MF-->>W: Screen responses
        W-->>WS: ast.item_result_batch (batched)
        WS-->>B: Forward to browser (live)
        WS->>DB: Batch insert policies
    end

    W-->>WS: ast.complete { status }
    WS->>DB: Update execution status
    WS-->>B: ast.complete
```

## Pause / Resume / Cancel

```mermaid
stateDiagram-v2
    [*] --> Running: ast.run
    Running --> Paused: ast.control { pause }
    Paused --> Running: ast.control { resume }
    Running --> Cancelled: ast.control { cancel }
    Paused --> Cancelled: ast.control { cancel }
    Running --> Completed: All items processed
    Running --> Failed: Error
    Completed --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

Controls are available in three locations:
- **Terminal toolbar** - status indicator + Pause/Resume and Stop buttons
- **AST form** - below the progress bar during execution
- **History page** - in the policies panel header when viewing a running/paused execution

## Cross-Pod Session Routing

```mermaid
flowchart TD
    B[Browser WS Connect] --> Auth[Verify JWT]
    Auth --> Lookup[Check session_assignments in DB]
    Lookup --> Exists{Assignment exists?}

    Exists -->|No| Assign[Assign to least-loaded pod]
    Assign --> Local

    Exists -->|Yes| Owner{This pod owns it?}
    Owner -->|Yes| Local[Attach to local Worker]
    Owner -->|No| Proxy[Proxy WS to remote pod]

    Proxy --> Health{Remote pod alive?}
    Health -->|Yes| Bridge[Bridge: Browser WS <-> Remote WS]
    Health -->|No| Reassign[Terminate + reassign to new pod]
    Reassign --> Local
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Server** | Fastify, Worker Threads, tnz3270-node, Drizzle ORM, Zod, jose |
| **Web** | React 19, Vite, TanStack Router + Query, Zustand, Tailwind CSS v4, xterm.js |
| **Auth** | Azure Entra ID (MSAL + JWT verification) |
| **Database** | PostgreSQL 16 |
| **Testing** | Vitest, Playwright |

## Project Structure

```
iast-aws-node/
├── packages/
│   ├── server/src/
│   │   ├── ast/              # AST logic (runs in worker thread)
│   │   │   ├── runner.ts     # Orchestration + pause/resume/cancel
│   │   │   ├── progress.ts   # Batched result reporting
│   │   │   ├── login/        # Login AST
│   │   │   ├── bi-renew/     # BI Renew AST
│   │   │   └── rout-extractor/ # Route Extractor AST
│   │   ├── terminal/         # Worker thread management + WS routing
│   │   │   ├── manager.ts    # Spawn/track workers
│   │   │   ├── worker.ts     # Worker entry (Tnz + Session)
│   │   │   ├── ws-handler.ts # Browser WS <-> Worker bridge
│   │   │   ├── registry.ts   # Cross-pod session assignments
│   │   │   └── renderer.ts   # ANSI screen rendering
│   │   ├── routes/           # REST API endpoints
│   │   ├── services/         # Business logic
│   │   ├── auth/             # Entra ID JWT verification
│   │   └── db/schema/        # Drizzle schema (9 tables)
│   │
│   ├── web/src/
│   │   ├── routes/           # TanStack Router pages
│   │   │   ├── index.tsx     # Terminal (multi-tab sessions)
│   │   │   ├── history/      # Execution history + policy details
│   │   │   ├── auto-launcher-runs/ # AutoLauncher monitoring
│   │   │   └── schedules/    # Scheduled executions
│   │   ├── ast/              # AST forms + registry
│   │   ├── terminal/         # xterm.js + session selector
│   │   ├── stores/           # Zustand state (session, AST, drafts)
│   │   ├── providers/        # ASTEventBridge (WS -> store)
│   │   ├── hooks/            # useTerminal, useAST, useApi, etc.
│   │   └── services/         # API clients + WebSocket class
│   │
│   └── shared/               # Shared types (planned)
│
├── docker-compose.yml        # PostgreSQL 16
└── AGENTS.md                 # AI coding rules
```

## Database Schema

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ executions : runs
    users ||--o{ ast_configs : owns
    users ||--o{ auto_launchers : owns
    users ||--o{ schedules : creates
    sessions ||--o{ executions : contains
    executions ||--o{ policies : produces
    auto_launchers ||--o{ auto_launcher_runs : triggers

    users {
        uuid id PK
        text email UK
        text display_name
        text alias
        text entra_id
    }

    sessions {
        text id PK
        uuid user_id FK
        text name
    }

    executions {
        text id PK
        text session_id FK
        uuid user_id FK
        text ast_name
        text status
        text host_user
        text run_id
        text execution_date
    }

    policies {
        uuid id PK
        text execution_id FK
        text policy_number
        text status
        int duration_ms
        text error
        jsonb data
    }

    ast_configs {
        uuid id PK
        text ast_name
        uuid owner_id FK
        text name
        text visibility
        jsonb params
        jsonb tasks
    }

    auto_launchers {
        uuid id PK
        uuid owner_id FK
        text name
        text visibility
        jsonb steps
    }

    schedules {
        uuid id PK
        uuid user_id FK
        text ast_name
        timestamp scheduled_time
        text status
        jsonb encrypted_credentials
    }
```

## Getting Started

### Prerequisites

- Node.js 22+
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL
npm run docker:up

# Push database schema
npm run db:push

# Start development (web + server)
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web + server in dev mode |
| `npm run dev:web` | Start web only |
| `npm run dev:server` | Start server only |
| `npm test` | Run all tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Lint all packages |
| `npm run format` | Format with Prettier |
| `npm run db:push` | Push Drizzle schema to DB |
| `npm run db:reset` | Reset DB (destroy + recreate + push schema) |
| `npm run docker:up` | Start PostgreSQL container |
| `npm run docker:down` | Stop PostgreSQL container |

### Environment Variables

Create `.env` files in each package:

**`packages/server/.env`**
```
DATABASE_URL=postgres://iast:iast_dev@localhost:5432/iast
PORT=3001
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
TN3270_HOST=...
TN3270_PORT=23
TN3270_SSL=true
POD_IP=127.0.0.1
ENCRYPTION_KEY=... (32-byte hex for AES-256-GCM)
```

**`packages/web/.env`**
```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_AZURE_CLIENT_ID=...
VITE_AZURE_TENANT_ID=...
```

## WebSocket Message Protocol

### Browser -> Server

| Type | Purpose |
|------|---------|
| `connect` | Initialize terminal session |
| `disconnect` | Close terminal session |
| `key` | Send PF/PA/Enter key |
| `data` | Send text input |
| `cursor` | Move cursor position |
| `ast.run` | Start AST execution |
| `ast.control` | Pause/resume/cancel AST |
| `ast.getStatus` | Query current AST status |

### Server -> Browser

| Type | Purpose |
|------|---------|
| `connected` | Terminal session established |
| `disconnected` | Terminal session closed |
| `screen` | Screen update (ANSI + metadata) |
| `ast.status` | AST status change |
| `ast.progress` | Progress update (current/total) |
| `ast.item_result_batch` | Batch of policy results |
| `ast.complete` | AST execution finished |
| `error` | Error message |

## Performance Design

- **Worker thread isolation**: AST CPU work doesn't block HTTP/WS routing
- **Batched WS messages**: 50 items/batch or 200ms flush interval
- **Batched DB inserts**: Multi-row INSERT via Drizzle
- **Live status overlay**: UI reads from Zustand AST store for real-time status, falls back to DB data
- **Reactive query invalidation**: TanStack Query keys include AST store state for automatic refetch on step transitions
