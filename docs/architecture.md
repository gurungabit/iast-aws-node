# Architecture Overview

## System Context

IAST enables users to automate interactions with IBM mainframe systems (CICS/TSO) via TN3270 terminal emulation. Users connect through a browser-based terminal, execute Automated System Tasks (ASTs) that process insurance policies in bulk, and review results through a history interface.

```mermaid
graph TB
    subgraph Users
        U[Browser Client]
    end

    subgraph Azure
        ENTRA[Azure Entra ID]
    end

    subgraph "AWS - ROSA Cluster"
        subgraph "OpenShift Namespace"
            WEB[Web Pod<br/>React SPA<br/>Served via nginx/Caddy]
            API[Server Pod<br/>Fastify + Worker Threads]
        end
    end

    subgraph "AWS Managed Services"
        RDS[(Amazon RDS<br/>PostgreSQL 16)]
        EB[EventBridge<br/>Scheduler]
        SM[Secrets Manager]
    end

    subgraph "Enterprise Network"
        MF[IBM Mainframe<br/>TN3270 Host]
        DB2[(DB2 Database)]
        SMB[SMB File Share]
    end

    U -->|HTTPS| WEB
    U -->|WSS + HTTPS| API
    U -->|OAuth 2.0| ENTRA
    API -->|TCP/TLS :1023| MF
    API -->|SQL :5432| RDS
    API -->|HTTPS| EB
    API -->|HTTPS| SM
    API -->|ODBC| DB2
    API -->|SMB| SMB
    ENTRA -.->|JWT Validation| API
    EB -.->|Trigger| API
```

## High-Level Architecture

The application follows a monorepo structure with three packages sharing types:

```mermaid
graph LR
    subgraph "packages/web"
        WEB[React SPA]
    end

    subgraph "packages/server"
        SRV[Fastify Server]
    end

    subgraph "packages/shared"
        TYPES[Shared Types<br/>Messages, AST, Auth]
    end

    WEB --> TYPES
    SRV --> TYPES
    WEB -->|HTTP + WS| SRV
```

## Server Internal Architecture

The server uses a **main thread + worker thread** model. The main thread handles all HTTP/WebSocket routing and database access. Each TN3270 terminal session runs in an isolated Worker thread, keeping the main thread responsive.

```mermaid
graph TB
    subgraph "Main Thread"
        direction TB
        FASTIFY[Fastify Server]
        AUTH[Auth Hook<br/>Entra JWT]
        ROUTES[REST Routes<br/>sessions, history,<br/>configs, schedules]
        WS[WebSocket Handler<br/>/api/terminal/:id]
        TM[TerminalManager<br/>Worker Pool]
        DB[Drizzle ORM<br/>DB Client]

        FASTIFY --> AUTH
        FASTIFY --> ROUTES
        FASTIFY --> WS
        WS --> TM
        ROUTES --> DB
        WS -->|persist policies| DB
    end

    subgraph "Worker Thread 1"
        W1_TNZ[tnz3270-node<br/>Ati + Tnz]
        W1_SES[Session Wrapper]
        W1_AST[AST Runner<br/>login, bi-renew,<br/>rout-extractor]
        W1_REN[ANSI Renderer]

        W1_TNZ --> W1_SES
        W1_SES --> W1_AST
        W1_TNZ --> W1_REN
    end

    subgraph "Worker Thread 2"
        W2_TNZ[tnz3270-node]
        W2_SES[Session]
        W2_AST[AST Runner]
    end

    subgraph "Worker Thread N"
        WN[...]
    end

    TM -->|spawn/manage| W1_TNZ
    TM -->|spawn/manage| W2_TNZ
    TM -->|spawn/manage| WN
    WS <-->|MessagePort| W1_TNZ
    WS <-->|MessagePort| W2_TNZ

    RDS[(RDS PostgreSQL)]
    MF[Mainframe<br/>TN3270]

    DB --> RDS
    W1_TNZ -->|TN3270 TCP/TLS| MF
    W2_TNZ -->|TN3270 TCP/TLS| MF
```

## ROSA Deployment Architecture

The application deploys to a Red Hat OpenShift Service on AWS (ROSA) cluster. OpenShift manages pod scaling, networking, and secrets.

```mermaid
graph TB
    subgraph "AWS VPC"
        subgraph "ROSA Cluster"
            subgraph "iast Namespace"
                direction TB

                ROUTE_WEB[OpenShift Route<br/>iast.apps.rosa.example.com]
                ROUTE_API[OpenShift Route<br/>iast-api.apps.rosa.example.com]

                subgraph "Web Deployment"
                    WEB1[Web Pod 1<br/>nginx + SPA]
                    WEB2[Web Pod 2<br/>nginx + SPA]
                end

                SVC_WEB[Service: web<br/>:8080]

                subgraph "Server Deployment"
                    SRV1[Server Pod 1<br/>Fastify + Workers<br/>up to 50 workers/pod]
                    SRV2[Server Pod 2<br/>Fastify + Workers<br/>up to 50 workers/pod]
                    SRV3[Server Pod 3<br/>Fastify + Workers<br/>up to 50 workers/pod]
                end

                SVC_API[Service: server<br/>:3000]

                HPA[HorizontalPodAutoscaler<br/>scale on activeWorkers metric]
            end
        end

        subgraph "AWS Services"
            RDS[(RDS PostgreSQL 16<br/>Multi-AZ)]
            EB[EventBridge Scheduler]
            SM[Secrets Manager]
        end
    end

    subgraph "Enterprise Network"
        MF[IBM Mainframe<br/>TN3270]
    end

    ROUTE_WEB --> SVC_WEB --> WEB1 & WEB2
    ROUTE_API --> SVC_API --> SRV1 & SRV2 & SRV3

    SRV1 & SRV2 & SRV3 -->|port 5432| RDS
    SRV1 & SRV2 & SRV3 -->|TN3270 :1023| MF
    SRV1 & SRV2 & SRV3 --> EB
    SRV1 & SRV2 & SRV3 --> SM
    HPA -.->|GET /metrics| SRV1 & SRV2 & SRV3
```

### Session Routing (Pod Affinity Without Sticky Sessions)

Worker threads live in a single pod's memory. With multiple pods behind a load balancer, requests must reach the **correct pod** that owns the session. We solve this with a **database-backed session registry** instead of sticky load balancers.

```mermaid
graph LR
    subgraph "Browser reconnects"
        B[Browser WS]
    end

    subgraph "OpenShift"
        LB[Load Balancer]
        P1[Pod 1<br/>receives request]
        P2[Pod 2<br/>owns session X]
    end

    DB[(PostgreSQL<br/>session_assignments)]

    B -->|WS| LB -->|any pod| P1
    P1 -->|lookup session X| DB
    DB -->|pod_ip = Pod 2| P1
    P1 -->|internal WS proxy| P2
    P2 -->|Worker thread| W[session X]
```

Key components:
- **`session_assignments` table**: Maps `session_id -> pod_ip` in PostgreSQL
- **Headless Service DNS**: Discovers all pod IPs for load balancing and health checks
- **Internal WS endpoint**: Pod-to-pod proxy when request hits wrong pod
- **Least-loaded assignment**: New sessions go to the pod with fewest active workers
- **Failover**: Dead pods detected via DNS, sessions reassigned to healthy pods

See **[Session Routing](./session-routing.md)** for the full design, failure recovery, and comparison with the original iast-aws DynamoDB-based registry.

### Scaling Strategy

| Component | Scaling | Trigger |
|-----------|---------|---------|
| Web Pods | HPA 2-5 replicas | CPU utilization |
| Server Pods | HPA 2-10 replicas | `activeWorkers / maxWorkers` from `/metrics` |
| Worker Threads | Up to 50 per pod | One per active terminal session |
| RDS | Vertical (instance class) | Connection count / CPU |

The `/metrics` endpoint exposes `activeWorkers` and `maxWorkers` counts. OpenShift HPA queries this to scale server pods when worker utilization exceeds the threshold.

```
Total capacity = pods x maxWorkersPerPod
Example: 5 pods x 50 workers = 250 concurrent sessions
```

### Pod Resource Limits

```yaml
# Server pod (worker-heavy)
resources:
  requests:
    cpu: "500m"
    memory: "512Mi"
  limits:
    cpu: "2000m"
    memory: "2Gi"

# Web pod (static assets)
resources:
  requests:
    cpu: "50m"
    memory: "64Mi"
  limits:
    cpu: "200m"
    memory: "128Mi"
```

## Request Flow

### Terminal Session Lifecycle

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server (Main Thread)
    participant W as Worker Thread
    participant M as Mainframe

    B->>S: POST /sessions (create)
    S->>S: Store session in DB
    S-->>B: { sessionId }

    B->>S: WS /api/terminal/:id?token=JWT
    S->>S: Verify JWT
    S->>W: Spawn Worker Thread
    S->>S: Attach WS to Worker

    B->>S: { type: "connect" }
    S->>W: postMessage({ type: "connect" })
    W->>M: TN3270 TCP/TLS Connect
    M-->>W: 3270 Data Stream
    W->>W: Render ANSI
    W->>S: { type: "screen", ansi, meta }
    S-->>B: WS frame: { type: "screen", ansi, meta }

    loop User Interaction
        B->>S: { type: "key", key: "enter" }
        S->>W: postMessage
        W->>M: TN3270 AID key
        M-->>W: Screen update
        W->>S: { type: "screen", ... }
        S-->>B: WS frame
    end

    B->>S: DELETE /sessions/:id
    S->>W: postMessage({ type: "disconnect" })
    W->>M: Disconnect
    S->>S: Terminate Worker
```

### AST Execution Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server (Main Thread)
    participant W as Worker Thread
    participant M as Mainframe
    participant DB as RDS PostgreSQL

    B->>S: WS: { type: "ast.run", astName: "login", params }
    S->>DB: Create execution record
    S->>W: postMessage({ type: "ast.run", ... })

    W->>W: ASTRunner.run()
    W->>S: { type: "ast.status", status: "running" }
    S-->>B: Forward status

    loop For each policy
        W->>M: Navigate screens
        M-->>W: Screen data
        W->>W: Process policy result
        W->>W: Buffer result (ProgressReporter)
    end

    Note over W: Flush every 200ms or 50 items
    W->>S: { type: "ast.item_result_batch", items: [...] }
    S->>DB: Batch INSERT policy_results
    S-->>B: Forward batch to UI

    W->>S: { type: "ast.progress", current, total }
    S-->>B: Forward progress

    W->>S: { type: "ast.complete", status: "completed" }
    S->>DB: Update execution status
    S-->>B: Forward completion
```

## AWS Service Integration

```mermaid
graph LR
    subgraph "ROSA Server Pod"
        APP[Fastify Server]
    end

    subgraph "AWS Services"
        RDS[(RDS PostgreSQL<br/>Sessions, Executions,<br/>Policies, Configs)]
        EB[EventBridge Scheduler<br/>One-time schedule triggers]
        SM[Secrets Manager<br/>Shared credentials<br/>under iast/ prefix]
    end

    APP -->|Drizzle ORM<br/>pg driver| RDS
    APP -->|CreateScheduleCommand<br/>DeleteScheduleCommand| EB
    APP -->|GetSecretValue| SM
    EB -->|Invoke target| APP
```

### EventBridge Scheduler Flow

Used for deferred/scheduled AST executions:

1. User creates schedule via `POST /schedules`
2. Server encrypts credentials (AES-256-GCM) and stores in DB
3. Server creates EventBridge one-time schedule (`at(...)` expression)
4. At trigger time, EventBridge invokes target (server endpoint)
5. Server decrypts credentials, spawns worker, runs AST
6. Schedule auto-deletes after execution (`ActionAfterCompletion: DELETE`)

### Secrets Manager

Credentials with prefix `iast/` store shared mainframe host credentials. The encryption key for per-schedule credential storage comes from `ENCRYPTION_KEY` env var (injected via OpenShift Secret).
