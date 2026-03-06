# AST Engine

## Overview

Automated System Tasks (ASTs) are pre-programmed sequences that drive the TN3270 terminal to perform bulk operations on the mainframe. The AST engine runs entirely inside Worker threads, keeping the main thread free for HTTP/WebSocket handling.

## AST Types

| AST Name | Purpose | Key Operations |
|----------|---------|----------------|
| `login` | Authenticate to mainframe | Fill userid/password fields, navigate to target screen |
| `bi-renew` | Business Insurance renewal processing | Login, iterate policies, perform renewal actions, query DB2 |
| `rout-extractor` | Route item extraction | Two modes: 412-file parsing or ROUT screen navigation |

## Execution Architecture

```mermaid
graph TB
    subgraph "Worker Thread"
        WORKER[worker.ts<br/>Message Handler]
        EXEC[executor.ts<br/>AST Dispatcher]
        RUNNER[ASTRunner<br/>Orchestration]
        PROGRESS[ProgressReporter<br/>Batched Output]

        subgraph "AST Implementations"
            LOGIN[login.ts]
            BIRENEW[bi-renew.ts]
            ROUT[rout-extractor/]
        end

        SESSION[Session<br/>3270 Wrapper]

        WORKER -->|ast.run| EXEC
        EXEC --> RUNNER
        RUNNER --> LOGIN & BIRENEW & ROUT
        LOGIN & BIRENEW & ROUT --> SESSION
        RUNNER --> PROGRESS
    end

    subgraph "Main Thread"
        WS[WebSocket Handler]
        DB[executionService]
    end

    PROGRESS -->|parentPort.postMessage<br/>ast.item_result_batch| WS
    WS -->|batch INSERT| DB
    WS -->|forward| BROWSER[Browser]

    SESSION <-->|TN3270| MF[Mainframe]
```

## ASTRunner (`ast/runner.ts`)

The runner wraps an AST implementation with lifecycle management:

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Running: run(astName, params)
    Running --> Running: checkpoint() passes
    Running --> Paused: ast.control { action: "pause" }
    Paused --> Running: ast.control { action: "resume" }
    Running --> Cancelled: ast.control { action: "cancel" }
    Paused --> Cancelled: ast.control { action: "cancel" }
    Running --> Completed: AST finishes successfully
    Running --> Failed: Unrecoverable error
    Completed --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

### Checkpoint Mechanism

Between each policy iteration, the runner calls `checkpoint()`:
- If **paused**: blocks until resumed or cancelled
- If **cancelled**: throws `CancellationError` to unwind the stack
- If **running**: returns immediately (zero overhead)

This allows users to pause/cancel long-running ASTs mid-execution without data corruption.

## ProgressReporter (`ast/progress.ts`)

Batches individual policy results to minimize WebSocket frame overhead:

```
Configuration:
  flushInterval: 200ms
  maxBatchSize: 50 items

Behavior:
  reportItem(result)  -> Buffer in memory
  reportProgress(current, total) -> Send immediately
  flush()             -> Send buffered items as ast.item_result_batch
  Auto-flush every 200ms OR when buffer hits 50 items
```

Performance impact for 2000 policies:
- Without batching: 2000 WebSocket frames + 2000 DB inserts
- With batching: ~40 WebSocket frames + ~20 batch DB inserts

## AST Implementations

### Login AST (`ast/login.ts`)

Simple authentication automation:

```mermaid
graph TD
    START[Start] --> CHECK{Already at<br/>target screen?}
    CHECK -->|Yes| DONE[Success]
    CHECK -->|No| FILL_USER[Fill Userid field]
    FILL_USER --> FILL_PASS[Fill Password field]
    FILL_PASS --> FILL_APP[Fill Application field<br/>if specified]
    FILL_APP --> ENTER[Press Enter]
    ENTER --> WAIT{Wait for<br/>expected keyword}
    WAIT -->|Found| DONE
    WAIT -->|Timeout| FAIL[Failure]
```

### BI Renew AST (`ast/bi-renew.ts`)

Insurance renewal processing with mainframe + DB2 interaction:

```mermaid
graph TD
    START[Start] --> LOGIN[Authenticate to host]
    LOGIN --> ITERATE[For each policy in task list]

    subgraph "Per Policy"
        ITERATE --> NAV[Navigate to policy screen]
        NAV --> READ[Read policy data]
        READ --> DB2[Query DB2 for details]
        DB2 --> PROCESS[Process renewal logic]
        PROCESS --> REPORT[Report result]
    end

    REPORT --> CHECK{More policies?}
    CHECK -->|Yes| ITERATE
    CHECK -->|No| COMPLETE[AST Complete]
```

Integrations used:
- **DB2**: Query policy details from IBM DB2 database
- **SMB**: Access file shares for data files

### Route Extractor AST (`ast/rout-extractor/`)

The most complex AST with two operating modes:

```mermaid
graph TD
    START[Start] --> MODE{Extraction Mode}

    MODE -->|412 File| FILE_START[Download 412 file via SMB]
    FILE_START --> PARSE[Parse fixed-width records]
    PARSE --> FILTER[Apply policy filters]
    FILTER --> ENRICH{PDQ Enrichment?}
    ENRICH -->|Yes| PDQ[Query policy types from mainframe]
    ENRICH -->|No| RESULTS_FILE[Output filtered results]
    PDQ --> RESULTS_FILE

    MODE -->|ROUT Screen| ROUT_START[Login to mainframe]
    ROUT_START --> NAV_ROUT[Navigate to ROUT screen]
    NAV_ROUT --> ITERATE[Iterate ROUT entries]

    subgraph "Per ROUT Entry"
        ITERATE --> READ_SCREEN[Read screen data]
        READ_SCREEN --> EXTRACT[Extract fields]
        EXTRACT --> FILTER_ROUT[Apply filters]
        FILTER_ROUT --> REPORT_ROUT[Report result]
    end

    REPORT_ROUT --> NEXT{More entries?}
    NEXT -->|Yes| ITERATE
    NEXT -->|No| RESULTS_ROUT[Output results]
```

Sub-modules:
| File | Purpose |
|------|---------|
| `index.ts` | Entry point, mode selection |
| `file-412.ts` | Fixed-width 412 file parser |
| `filters.ts` | Policy filtering logic |
| `models.ts` | Configuration model building |
| `policy-types.ts` | PDQ policy type resolution |
| `rout-screen.ts` | Mainframe ROUT screen navigation |

## AutoLauncher

AutoLaunchers chain multiple ASTs into sequential pipelines:

```mermaid
sequenceDiagram
    participant U as User
    participant S as Server (Main Thread)
    participant W as Worker Thread
    participant DB as Database

    U->>S: Start AutoLauncher Run
    S->>DB: Create auto_launcher_run (status: running)

    loop For each step
        S->>DB: Create execution record
        S->>W: { type: "ast.run", astName, params }
        W-->>S: { type: "ast.status", status: "running" }
        W-->>S: { type: "ast.item_result_batch", ... }
        S->>DB: Batch insert policies
        W-->>S: { type: "ast.complete", status: "completed" }
        S->>DB: Update step status in run
    end

    alt All steps completed
        S->>DB: Update run status: completed
    else Step failed
        S->>DB: Update run status: failed
        S->>DB: Mark remaining steps: cancelled
    end
```

## Performance Characteristics

### Server-Side

| Optimization | Detail |
|-------------|--------|
| Worker thread isolation | AST CPU work doesn't block HTTP/WS routing |
| Batched WS messages | 50 items/batch or 200ms flush interval |
| Batched DB inserts | Multi-row INSERT via Drizzle |
| Cursor-based pagination | History queries on indexed columns |
| Worker pool limits | Configurable `MAX_WORKERS` per pod (default 50) |

### Client-Side

| Optimization | Detail |
|-------------|--------|
| Virtual scrolling | `@tanstack/react-virtual` for policy result lists |
| Batched state updates | Process `ast.item_result_batch` as single Zustand update |
| Selective re-rendering | Zustand selectors per tab, React.memo on heavy components |
| Debounced progress bar | `requestAnimationFrame` throttling |

## Shared Types

```typescript
type ASTName = 'login' | 'bi-renew' | 'rout-extractor'

type ASTStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

interface ASTCredentials {
  userId: string
  password: string
}

interface ASTParams {
  credentials: ASTCredentials
  host?: string
  region?: string
  tasks?: ASTTask[]
  [key: string]: unknown   // AST-specific params
}

interface ASTItemResult {
  id: string
  policyNumber: string
  status: 'success' | 'failure' | 'skipped' | 'error'
  durationMs: number
  error?: string
  data?: Record<string, unknown>
}

interface ASTProgress {
  current: number
  total: number
  message: string
}
```
