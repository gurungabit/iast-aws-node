# Database Schema

## Overview

The application uses **PostgreSQL 16** (Amazon RDS in production, Docker locally) with **Drizzle ORM** for type-safe schema definitions and queries.

- Connection: `DATABASE_URL` environment variable
- ORM: `drizzle-orm` with `pg` driver
- Migrations: Drizzle Kit (`drizzle-kit`)

## Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ sessions : "has"
    users ||--o{ executions : "runs"
    users ||--o{ ast_configs : "owns"
    users ||--o{ auto_launchers : "owns"
    users ||--o{ auto_launcher_runs : "runs"
    users ||--o{ schedules : "creates"
    users ||--o{ session_assignments : "owns"

    sessions ||--o{ executions : "contains"
    sessions ||--o{ auto_launcher_runs : "used_by"
    sessions ||--|| session_assignments : "assigned_to"

    executions ||--o{ policy_results : "produces"

    auto_launchers ||--o{ auto_launcher_runs : "triggers"

    users {
        uuid id PK
        text email UK
        text display_name
        text alias
        text entra_id
        timestamptz created_at
        timestamptz updated_at
    }

    sessions {
        text id PK
        uuid user_id FK
        text name
        timestamptz created_at
        timestamptz updated_at
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
        timestamptz started_at
        timestamptz completed_at
        integer total_policies
        integer success_count
        integer failure_count
        integer error_count
    }

    policy_results {
        uuid id PK
        text execution_id FK
        text policy_number
        text status
        integer duration_ms
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
        timestamptz created_at
        timestamptz updated_at
    }

    auto_launchers {
        uuid id PK
        uuid owner_id FK
        text name
        text visibility
        jsonb steps
        timestamptz created_at
        timestamptz updated_at
    }

    auto_launcher_runs {
        text id PK
        uuid launcher_id FK
        uuid user_id FK
        text session_id FK
        text status
        jsonb steps
        text current_step_index
        timestamptz created_at
        timestamptz completed_at
    }

    session_assignments {
        text session_id PK_FK
        text pod_ip
        uuid user_id FK
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    schedules {
        uuid id PK
        uuid user_id FK
        text ast_name
        timestamptz scheduled_time
        text status
        jsonb params
        jsonb encrypted_credentials
        text event_bridge_schedule_name
        timestamptz created_at
        timestamptz updated_at
    }
```

## Tables

### `users`

Auto-provisioned from Azure Entra ID tokens on first login.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default random | Internal user ID |
| `email` | `text` | NOT NULL, UNIQUE | User email from Entra token |
| `display_name` | `text` | NOT NULL | Display name from Entra |
| `alias` | `text` | NOT NULL, default `''` | User alias |
| `entra_id` | `text` | NOT NULL | Azure Entra Object ID (oid) |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `updated_at` | `timestamptz` | NOT NULL, default now() | |

**Indexes:** `users_email_idx` UNIQUE on `(email)`

### `sessions`

Terminal sessions owned by users. One session = one TN3270 connection.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | PK | Session identifier (e.g., `ses_abc123`) |
| `user_id` | `uuid` | FK -> users.id | Owner |
| `name` | `text` | NOT NULL, default `''` | User-assigned session name |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `updated_at` | `timestamptz` | NOT NULL, default now() | |

**Indexes:** `sessions_user_id_idx` on `(user_id)`

### `session_assignments`

Maps each active terminal session to the pod that owns its Worker thread. Used for session routing across multiple server pods. Replaces the DynamoDB-based registry from the original iast-aws.

See **[Session Routing](./session-routing.md)** for the full routing design.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `session_id` | `text` | PK, FK -> sessions.id, CASCADE | Session being assigned |
| `pod_ip` | `text` | NOT NULL | IP of the pod that owns the Worker thread |
| `user_id` | `uuid` | FK -> users.id | Session owner |
| `status` | `text` | NOT NULL, default `active` | `active` or `terminated` |
| `created_at` | `timestamptz` | NOT NULL, default now() | When assignment was created |
| `updated_at` | `timestamptz` | NOT NULL, default now() | Last status change |

**Indexes:** `session_assignments_pod_status_idx` on `(pod_ip, status)` WHERE `status = 'active'` -- efficient load-counting query

**Key queries:**
- **Lookup**: `SELECT pod_ip FROM session_assignments WHERE session_id = ?` -- O(1) by PK
- **Load count**: `SELECT pod_ip, COUNT(*) FROM session_assignments WHERE status = 'active' GROUP BY pod_ip` -- uses partial index
- **Cleanup on pod death**: `UPDATE session_assignments SET status = 'terminated' WHERE pod_ip = ?`

### `executions`

Each AST run creates one execution record. Tracks overall status and aggregate counts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | PK | Execution ID (e.g., `exec_abc123`) |
| `session_id` | `text` | FK -> sessions.id, CASCADE | Terminal session used |
| `user_id` | `uuid` | FK -> users.id | User who ran the AST |
| `ast_name` | `text` | NOT NULL | `login`, `bi-renew`, or `rout-extractor` |
| `status` | `text` | NOT NULL, default `running` | `running`, `completed`, `failed`, `cancelled` |
| `host_user` | `text` | nullable | Mainframe userid used |
| `run_id` | `text` | nullable | Links to auto_launcher_runs.id if part of a run |
| `execution_date` | `text` | NOT NULL | ISO date string for partitioning queries |
| `started_at` | `timestamptz` | NOT NULL, default now() | |
| `completed_at` | `timestamptz` | nullable | |
| `total_policies` | `integer` | NOT NULL, default 0 | Total processed |
| `success_count` | `integer` | NOT NULL, default 0 | |
| `failure_count` | `integer` | NOT NULL, default 0 | |
| `error_count` | `integer` | NOT NULL, default 0 | |

**Indexes:**
- `executions_user_date_idx` on `(user_id, execution_date)` -- history queries
- `executions_session_status_idx` on `(session_id, status)` -- active session lookups
- `executions_run_id_idx` on `(run_id)` -- AutoLauncher run association

### `policy_results`

Individual policy processing results from AST executions. Can be thousands of rows per execution.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default random | |
| `execution_id` | `text` | FK -> executions.id, CASCADE | Parent execution |
| `policy_number` | `text` | NOT NULL | Insurance policy number |
| `status` | `text` | NOT NULL | `success`, `failure`, `skipped`, `error` |
| `duration_ms` | `integer` | NOT NULL, default 0 | Processing time per policy |
| `error` | `text` | nullable | Error message if failed |
| `data` | `jsonb` | nullable | AST-specific result data |

**Indexes:** `policy_results_execution_status_idx` on `(execution_id, status)`

### `ast_configs`

Saved AST configurations. Can be private (owner-only) or public (visible to all).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default random | |
| `ast_name` | `text` | NOT NULL | Which AST this configures |
| `owner_id` | `uuid` | FK -> users.id | Creator |
| `name` | `text` | NOT NULL | Config display name |
| `visibility` | `text` | NOT NULL, default `private` | `private` or `public` |
| `params` | `jsonb` | NOT NULL, default `{}` | AST parameters (credentials excluded) |
| `tasks` | `jsonb` | NOT NULL, default `[]` | Task/policy list |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `updated_at` | `timestamptz` | NOT NULL, default now() | |

**Indexes:**
- `ast_configs_owner_ast_idx` on `(owner_id, ast_name)`
- `ast_configs_public_idx` on `(visibility)` WHERE `visibility = 'public'`

### `auto_launchers`

Multi-step AST pipeline definitions. Steps are ordered and executed sequentially.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default random | |
| `owner_id` | `uuid` | FK -> users.id | Creator |
| `name` | `text` | NOT NULL | Launcher name |
| `visibility` | `text` | NOT NULL, default `private` | `private` or `public` |
| `steps` | `jsonb` | NOT NULL, default `[]` | Array of `AutoLauncherStep` |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `updated_at` | `timestamptz` | NOT NULL, default now() | |

**Steps JSONB structure:**
```json
[
  { "id": "step_1", "astName": "login", "order": 0, "params": { ... } },
  { "id": "step_2", "astName": "bi-renew", "configId": "uuid", "order": 1, "params": { ... } }
]
```

**Indexes:**
- `auto_launchers_owner_idx` on `(owner_id)`
- `auto_launchers_public_idx` on `(visibility)` WHERE `visibility = 'public'`

### `auto_launcher_runs`

Execution instances of AutoLaunchers. Tracks which step is active and individual step status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `text` | PK | Run identifier |
| `launcher_id` | `uuid` | FK -> auto_launchers.id | Source launcher |
| `user_id` | `uuid` | FK -> users.id | Who triggered it |
| `session_id` | `text` | FK -> sessions.id, CASCADE | Terminal session |
| `status` | `text` | NOT NULL, default `pending` | `pending`, `running`, `completed`, `failed`, `cancelled` |
| `steps` | `jsonb` | NOT NULL, default `[]` | Array of step statuses |
| `current_step_index` | `text` | NOT NULL, default `'0'` | Active step index |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `completed_at` | `timestamptz` | nullable | |

**Indexes:** `auto_launcher_runs_user_idx` on `(user_id)`

### `schedules`

Deferred AST executions. Backed by AWS EventBridge Scheduler for trigger timing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default random | |
| `user_id` | `uuid` | FK -> users.id | |
| `ast_name` | `text` | NOT NULL | Which AST to run |
| `scheduled_time` | `timestamptz` | NOT NULL | When to execute |
| `status` | `text` | NOT NULL, default `pending` | `pending`, `scheduled`, `running`, `completed`, `failed` |
| `params` | `jsonb` | NOT NULL, default `{}` | AST parameters |
| `encrypted_credentials` | `jsonb` | nullable | AES-256-GCM encrypted credentials |
| `event_bridge_schedule_name` | `text` | nullable | AWS EventBridge schedule name |
| `created_at` | `timestamptz` | NOT NULL, default now() | |
| `updated_at` | `timestamptz` | NOT NULL, default now() | |

**Indexes:**
- `schedules_user_status_idx` on `(user_id, status)`
- `schedules_pending_idx` on `(status, scheduled_time)` WHERE `status = 'pending'`

## RDS Configuration

### Recommended Instance Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Engine | PostgreSQL 16 | Latest stable |
| Instance class | `db.r6g.large` | 2 vCPU, 16 GB RAM (start) |
| Storage | gp3, 100 GB | Auto-scaling enabled |
| Multi-AZ | Yes | For production availability |
| Backup retention | 7 days | Point-in-time recovery |
| Max connections | 200 | Shared across all server pods |
| SSL | Required | `sslmode=require` in connection string |

### Connection Pooling

Each server pod creates a Drizzle ORM connection pool. With multiple pods, total connections = `pods x pool_size`. Size the RDS instance accordingly.

```
Connection budget:
  3 pods x 20 pool connections = 60 active connections
  Headroom for migrations, monitoring = 20
  Total: ~80 of 200 max
```
