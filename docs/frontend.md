# Frontend Architecture

## Overview

The frontend is a React 19 single-page application built with Vite 7, using TanStack Router for file-based routing, Zustand for state management, and TanStack Query for server state.

## Component Tree

```mermaid
graph TB
    subgraph "Root"
        MSAL[MsalProvider]
        QC[QueryClientProvider]
        ROUTER[TanStack Router]
    end

    subgraph "Layout (__root.tsx)"
        AUTH_GUARD[AuthGuard]
        AST_PROVIDER[ASTProvider]
        AST_BRIDGE[ASTEventBridge]
        NAVBAR[Navbar]
    end

    subgraph "Pages"
        INDEX["index.tsx<br/>Terminal + AST Panel"]
        HISTORY["history/route.tsx<br/>Execution History"]
        SCHEDULES["schedules/route.tsx<br/>Schedule Management"]
        AL_RUNS["auto-launcher-runs/route.tsx<br/>AutoLauncher History"]
    end

    MSAL --> QC --> ROUTER
    ROUTER --> AUTH_GUARD --> AST_PROVIDER --> AST_BRIDGE
    AST_BRIDGE --> NAVBAR
    NAVBAR --> INDEX & HISTORY & SCHEDULES & AL_RUNS
```

## Main Page Layout (Terminal + AST)

```mermaid
graph TB
    subgraph "index.tsx"
        direction TB
        SS[SessionSelector<br/>Tab bar + create/rename/delete]

        subgraph "Split Panels"
            direction LR
            subgraph "Left Panel"
                TERM[TerminalComponent<br/>xterm.js + keyboard handler<br/>+ status bar]
            end
            subgraph "Right Panel"
                AST_PANEL[ASTPanel]
                AST_SEL[ASTSelector<br/>Dropdown]
                AST_FORM[AST Form<br/>Login / BiRenew / RoutExtractor]
                RESULTS[ItemResultList<br/>Virtual scrolling]
                PROGRESS[ProgressBar]
                STATUS[StatusLogList]
            end
        end
    end

    SS --> TERM & AST_PANEL
    AST_PANEL --> AST_SEL --> AST_FORM
    AST_PANEL --> RESULTS & PROGRESS & STATUS
```

## State Management

### Store Architecture

```mermaid
graph LR
    subgraph "Zustand Stores"
        SESSION[session-store<br/>Terminal tabs, WS connections,<br/>screen state, cursor meta]
        AST[ast-store<br/>Per-tab AST state,<br/>progress, results,<br/>AutoLauncher runs]
        DRAFT[auto-launcher-draft-store<br/>Draft launcher builder]
    end

    subgraph "Data Flow"
        WS[WebSocket Messages]
        BRIDGE[ASTEventBridge]
        UI[React Components]
    end

    WS --> BRIDGE
    BRIDGE -->|ast.status/progress/batch/complete| AST
    WS -->|screen| SESSION
    SESSION --> UI
    AST --> UI
    DRAFT --> UI
```

### session-store

Manages terminal session tabs and WebSocket connections.

```typescript
interface SessionTab {
  sessionId: string
  name: string
  ws: TerminalWebSocket | null
  connected: boolean
  screenAnsi: string
  meta: {
    cursorRow: number
    cursorCol: number
    locked: boolean
  }
}

interface SessionState {
  tabs: Map<string, SessionTab>
  activeTabId: string | null

  // Actions
  addTab(sessionId: string, name: string): void
  removeTab(sessionId: string): void
  setActiveTab(sessionId: string): void
  renameTab(sessionId: string, name: string): void
  setWs(sessionId: string, ws: TerminalWebSocket): void
  setConnected(sessionId: string, connected: boolean): void
  updateScreen(sessionId: string, ansi: string, meta: ScreenMeta): void
}
```

### ast-store

Per-tab AST execution state. Each terminal tab has independent AST state.

```typescript
interface TabASTState {
  selectedASTId: string | null
  runningAST: ASTName | null
  status: ASTStatus
  executionId: string | null
  progress: ASTProgress | null
  itemResults: ASTItemResult[]
  statusMessages: string[]
  autoLauncherRun: AutoLauncherRun | null
  credentials: ASTCredentials
  formOptions: Record<string, unknown>
  customFields: Record<string, unknown>
}
```

### auto-launcher-draft-store

Draft state for building new AutoLauncher definitions before saving.

## Real-Time Update Flow

```mermaid
sequenceDiagram
    participant WS as WebSocket
    participant Bridge as ASTEventBridge
    participant Store as ast-store
    participant UI as React Component

    WS->>Bridge: onMessage({ type: "ast.status", ... })
    Bridge->>Store: setStatus(tabId, status)
    Store-->>UI: Zustand selector triggers re-render

    WS->>Bridge: onMessage({ type: "ast.item_result_batch", items })
    Bridge->>Store: appendItems(tabId, items)
    Note over Store: Single Zustand update for entire batch
    Store-->>UI: ItemResultList re-renders (virtual scroll)

    WS->>Bridge: onMessage({ type: "ast.progress", progress })
    Bridge->>Store: setProgress(tabId, progress)
    Store-->>UI: ProgressBar updates
```

### Performance Optimizations

| Technique | Where | Impact |
|-----------|-------|--------|
| Virtual scrolling | ItemResultList (react-virtual) | ~30 DOM nodes for 2000+ results |
| Batched state updates | ASTEventBridge processes batch as single update | Prevents 50 re-renders per batch |
| Zustand selectors | Components select only needed slices | Prevent unrelated re-renders |
| React.memo | Heavy components (Terminal, ItemResultList) | Skip re-render on unchanged props |
| requestAnimationFrame | ProgressBar throttling | Max 10 visual updates/sec |

## AST Registry System

ASTs self-register at module load time. The registry provides search, filtering, and form component resolution.

```mermaid
graph TB
    subgraph "Registration (side-effect imports)"
        LOGIN_REG["login/register.ts<br/>registerAST({ id: 'login', ... })"]
        BIRENEW_REG["bi-renew/register.ts<br/>registerAST({ id: 'bi-renew', ... })"]
        ROUT_REG["rout-extractor/register.ts<br/>registerAST({ id: 'rout-extractor', ... })"]
    end

    subgraph "Registry"
        REG[astRegistry<br/>Map of ASTDefinition]
    end

    subgraph "Consumer"
        HOOK["useASTRegistry()<br/>search, filter, getAll"]
        SEL[ASTSelector dropdown]
        PANEL[ASTPanel form render]
    end

    LOGIN_REG & BIRENEW_REG & ROUT_REG --> REG
    REG --> HOOK --> SEL & PANEL
```

Each registered AST provides:
- `id`: Unique name (`ASTName`)
- `label`: Display name
- `description`: User-facing description
- `keywords`: Search terms
- `FormComponent`: React component for the AST's parameter form

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant APP as React App
    participant MSAL as MSAL.js
    participant ENTRA as Azure Entra ID
    participant API as Server API

    U->>APP: Navigate to app
    APP->>MSAL: Check auth state
    MSAL->>ENTRA: Silent token request
    alt Has valid session
        ENTRA-->>MSAL: Access token
        MSAL-->>APP: Authenticated
    else No session
        ENTRA-->>MSAL: Redirect required
        MSAL->>U: Redirect to Entra login
        U->>ENTRA: Enter credentials
        ENTRA-->>U: Redirect back with code
        MSAL->>ENTRA: Exchange code for tokens
        ENTRA-->>MSAL: Access token + ID token
        MSAL-->>APP: Authenticated
    end

    APP->>API: GET /auth/me (Bearer token)
    API-->>APP: User profile
    APP->>APP: Render authenticated UI
```

## Services Layer

API communication functions used by hooks and components:

| Service | Functions |
|---------|-----------|
| `api.ts` | `authFetch()`, `apiGet()`, `apiPost()`, `apiPatch()`, `apiDelete()` |
| `websocket.ts` | `TerminalWebSocket` class (connect, send, onMessage, disconnect) |
| `sessions.ts` | `getSessions()`, `createSession()`, `deleteSession()`, `renameSession()` |
| `ast-configs.ts` | CRUD for AST configs |
| `auto-launchers.ts` | CRUD for launchers + runs |
| `schedules.ts` | CRUD for schedules |

All HTTP functions use `authFetch()` which automatically attaches the MSAL Bearer token.

## Hooks

| Hook | Purpose |
|------|---------|
| `useApi` | `useApiQuery()` and `useApiMutation()` wrapping TanStack Query with auth |
| `useAST` | AST execution bridge (trigger runs, handle results) |
| `useTerminal` | Terminal lifecycle management (connect, resize, cleanup) |
| `useFormField` | Form field state with localStorage persistence |
| `useAuth` | Authentication state and user info |
| `useTheme` | Dark/light mode toggle with localStorage |

## UI Components

### Shared UI (`components/ui/`)

| Component | Description |
|-----------|-------------|
| `Button` | Primary/secondary/danger variants, loading state, icons |
| `Card` | Container with header, padding, shadow |
| `Checkbox` | Labeled checkbox with indeterminate state |
| `DatePicker` | Date selection with calendar dropdown |
| `DateTimePicker` | Combined date + time picker |
| `Input` | Text input with label, error, left/right icons |
| `ItemResultList` | Virtual-scrolled policy result list |
| `Modal` | Dialog overlay with close, header, footer |
| `ProgressBar` | Segmented progress bar with percentage |
| `StatusBadge` | Colored status indicator pills |
| `StatusLogList` | Timestamped log message list |
| `Toggle` | Switch toggle with label |
| `Tooltip` | Hover tooltip with positioning |
