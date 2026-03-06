# Session Routing & Pod Affinity

## The Problem

Worker threads live in a single process's memory. When multiple server pods run behind a load balancer, a user's terminal session (Worker thread) exists on **one specific pod**. If the next request routes to a different pod, the session isn't there.

```mermaid
graph LR
    B[Browser] -->|WS| LB[Load Balancer]
    LB -->|round-robin| POD1[Pod 1<br/>has session X]
    LB -->|round-robin| POD2[Pod 2<br/>no session X]
    LB -->|round-robin| POD3[Pod 3<br/>no session X]
```

**We cannot rely on sticky sessions** (load balancer affinity) because:
- OpenShift route session affinity is cookie-based and unreliable for WebSockets
- Pod scaling events break stickiness
- Pod restarts lose the session entirely

## Solution: Database-Backed Session Registry

Store which pod IP owns each session in PostgreSQL. On every WebSocket connection, look up the owning pod and **proxy directly to it** via an internal WebSocket.

This matches the pattern from the original iast-aws (which used DynamoDB + headless service DNS), adapted for PostgreSQL + ROSA.

### Architecture

```mermaid
graph TB
    subgraph "Browser"
        CLIENT[WebSocket Client]
    end

    subgraph "OpenShift"
        ROUTE[OpenShift Route<br/>iast-api.apps.rosa...]
        SVC[Service: iast-server<br/>ClusterIP - for HTTP]
        HEADLESS[Headless Service: iast-server-headless<br/>clusterIP: None - for pod discovery]

        subgraph "Pod 1 (10.0.1.10)"
            API1[Fastify Server]
            TM1[TerminalManager]
            W1A[Worker: session-A]
            W1B[Worker: session-B]
        end

        subgraph "Pod 2 (10.0.1.11)"
            API2[Fastify Server]
            TM2[TerminalManager]
            W2C[Worker: session-C]
        end

        subgraph "Pod 3 (10.0.1.12)"
            API3[Fastify Server]
            TM3[TerminalManager]
            W3D[Worker: session-D]
            W3E[Worker: session-E]
        end
    end

    RDS[(RDS PostgreSQL<br/>session_assignments table)]

    CLIENT -->|WSS| ROUTE
    ROUTE -->|any pod| API1
    API1 -->|query| RDS
    RDS -->|session-C is on 10.0.1.11| API1
    API1 -->|internal WS to 10.0.1.11| API2
    API2 -->|postMessage| W2C
```

### Request Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant LB as Load Balancer
    participant P1 as Pod 1 (receives request)
    participant DB as PostgreSQL
    participant DNS as Headless Service DNS
    participant P2 as Pod 2 (owns session)

    B->>LB: WS /api/terminal/session-C?token=JWT
    LB->>P1: Route to any healthy pod

    P1->>DB: SELECT pod_ip FROM session_assignments<br/>WHERE session_id = 'session-C'
    DB-->>P1: pod_ip = '10.0.1.11'

    alt Session is on THIS pod
        P1->>P1: Attach WS directly to local Worker
    else Session is on DIFFERENT pod
        P1->>P2: Internal WS to ws://10.0.1.11:3000/internal/terminal/session-C
        P2->>P2: Attach to local Worker
        Note over P1,P2: Bridge: Browser WS <-> Internal WS
        P2-->>P1: Worker messages
        P1-->>B: Forward to browser
    end
```

### New Session Assignment

```mermaid
sequenceDiagram
    participant B as Browser
    participant P1 as Pod (receives request)
    participant DNS as Headless Service DNS
    participant DB as PostgreSQL

    B->>P1: WS /api/terminal/new-session?token=JWT
    P1->>DB: SELECT pod_ip FROM session_assignments<br/>WHERE session_id = 'new-session'
    DB-->>P1: NULL (no assignment)

    P1->>DNS: Resolve iast-server-headless
    DNS-->>P1: [10.0.1.10, 10.0.1.11, 10.0.1.12]

    P1->>DB: SELECT pod_ip, COUNT(*) FROM session_assignments<br/>WHERE status = 'active' GROUP BY pod_ip
    DB-->>P1: {10.0.1.10: 2, 10.0.1.11: 1, 10.0.1.12: 2}

    Note over P1: Pick least-loaded: 10.0.1.11

    alt Least-loaded pod is THIS pod
        P1->>P1: Create Worker locally
    else Least-loaded pod is different
        P1->>P1: Assign to 10.0.1.11
    end

    P1->>DB: INSERT session_assignments<br/>(session_id, pod_ip, user_id, status)
    P1->>B: Proceed with connection
```

## Database Schema

### `session_assignments` Table

Tracks which pod owns each active terminal session. Replaces the DynamoDB-based registry from the original iast-aws.

```sql
CREATE TABLE session_assignments (
    session_id  TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    pod_ip      TEXT NOT NULL,
    user_id     UUID NOT NULL REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'terminated'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX session_assignments_pod_status_idx
    ON session_assignments (pod_ip, status)
    WHERE status = 'active';
```

| Column | Type | Description |
|--------|------|-------------|
| `session_id` | text | FK to sessions.id |
| `pod_ip` | text | IP address of the pod that owns the Worker thread |
| `user_id` | uuid | FK to users.id |
| `status` | text | `active` or `terminated` |
| `created_at` | timestamptz | When the assignment was made |
| `updated_at` | timestamptz | Last status update |

The partial index on `(pod_ip, status) WHERE status = 'active'` makes the load-counting query fast.

## Pod Discovery via Headless Service

A Kubernetes **headless Service** (`clusterIP: None`) returns individual pod IPs as DNS A records instead of a single ClusterIP. This lets any pod discover all other pods by IP.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: iast-server-headless
spec:
  clusterIP: None
  selector:
    app: iast-server
  ports:
    - port: 3000
      targetPort: 3000
```

```typescript
import { lookup } from 'node:dns/promises'

async function discoverPods(): Promise<string[]> {
  // dns.lookup (NOT dns.resolve4) uses OS resolver which respects
  // /etc/resolv.conf search domains — short K8s service names work
  const results = await lookup('iast-server-headless', { all: true, family: 4 })
  return results.map(r => r.address)
}

// Returns: ['10.0.1.10', '10.0.1.11', '10.0.1.12']
```

In local development, `localhost` resolves to `['127.0.0.1']` — single-pod behavior.

## Internal Pod-to-Pod WebSocket

When a request arrives at the wrong pod, it needs to proxy to the correct one. An **internal WebSocket endpoint** runs on every pod for this purpose:

```
GET /internal/terminal/:sessionId
```

This endpoint is **not exposed via the OpenShift Route** — it's only reachable via the pod's ClusterIP on the internal network. It skips JWT auth (internal trust) and directly attaches the WebSocket to the local Worker thread.

```mermaid
graph LR
    subgraph "Pod 1 (proxy)"
        BROWSER_WS[Browser WS]
        PROXY[Proxy Logic]
        INTERNAL_WS[Internal WS Client]
    end

    subgraph "Pod 2 (owner)"
        INTERNAL_HANDLER[Internal WS Handler]
        WORKER[Worker Thread<br/>session-C]
    end

    BROWSER_WS <--> PROXY
    PROXY <-->|ws://10.0.1.11:3000/internal/terminal/session-C| INTERNAL_WS
    INTERNAL_WS <--> INTERNAL_HANDLER
    INTERNAL_HANDLER <--> WORKER
```

Message bridge (same pattern as original iast-aws `bridge.ts`):
- Browser -> Proxy Pod -> Internal WS -> Owner Pod -> Worker
- Worker -> Owner Pod -> Internal WS -> Proxy Pod -> Browser

## Load Balancing Algorithm

When assigning a new session, pick the pod with the fewest active sessions:

```typescript
async function getLeastLoadedPod(): Promise<string> {
  const pods = await discoverPods()

  if (pods.length <= 1) return pods[0]

  // Query active session counts per pod
  const counts = await db.select({
    podIp: sessionAssignments.podIp,
    count: sql<number>`count(*)`,
  })
    .from(sessionAssignments)
    .where(eq(sessionAssignments.status, 'active'))
    .groupBy(sessionAssignments.podIp)

  const countMap = new Map(counts.map(r => [r.podIp, r.count]))

  let minCount = Infinity
  let candidates: string[] = []

  for (const podIp of pods) {
    const count = countMap.get(podIp) ?? 0
    if (count < minCount) {
      minCount = count
      candidates = [podIp]
    } else if (count === minCount) {
      candidates.push(podIp)
    }
  }

  // Random tie-break to avoid thundering herd
  return candidates[Math.floor(Math.random() * candidates.length)]
}
```

## Failure Recovery

### Pod Crash / Scale-Down

```mermaid
sequenceDiagram
    participant B as Browser
    participant P1 as Pod 1 (proxy)
    participant DB as PostgreSQL
    participant DNS as Headless DNS
    participant P3 as Pod 3 (new owner)

    Note over P1: Browser reconnects after Pod 2 crashed

    B->>P1: WS /api/terminal/session-C
    P1->>DB: Lookup session-C
    DB-->>P1: pod_ip = 10.0.1.11 (Pod 2 - dead)

    P1->>P1: Internal WS to 10.0.1.11 fails

    P1->>DNS: Resolve headless service
    DNS-->>P1: [10.0.1.10, 10.0.1.12] (Pod 2 gone)

    Note over P1: 10.0.1.11 not in DNS = pod is dead

    P1->>DB: UPDATE session_assignments<br/>SET status = 'terminated'<br/>WHERE pod_ip = '10.0.1.11'

    P1->>DB: Get session counts per pod
    Note over P1: Pick least-loaded: 10.0.1.12

    P1->>DB: UPDATE session_assignments<br/>SET pod_ip = '10.0.1.12', status = 'active'

    P1->>P3: Internal WS to 10.0.1.12
    P3->>P3: Create new Worker for session-C
    P3-->>P1: Connected
    P1-->>B: Session restored (new TN3270 connection)
```

**Important**: When a pod dies, the Worker thread and TN3270 connection are lost. The session can be **reassigned** to a new pod, but the user will need to reconnect to the mainframe. The terminal screen resets — this is inherent to TN3270 (the mainframe doesn't maintain screen state for disconnected clients).

### Recovery Decision Matrix

| Scenario | Detection | Action |
|----------|-----------|--------|
| Session on this pod | `podIp === myPodIp` | Attach directly to local Worker |
| Session on another live pod | Internal WS succeeds | Bridge browser to that pod |
| Session on dead pod | Internal WS fails + pod not in DNS | Reassign to least-loaded pod |
| Session on live pod, transient error | Internal WS fails + pod in DNS | Retry same pod after 1s delay |
| New session | No DB record | Assign to least-loaded pod |
| Already retried and failed | isRetry = true | Return error to browser |

## Comparison with Original iast-aws

| Aspect | Original (iast-aws) | New (iast-aws-node) |
|--------|---------------------|---------------------|
| Session storage | DynamoDB (`SESSION#/TERMINAL#mapping`) | PostgreSQL `session_assignments` table |
| Pod discovery | Headless Service DNS (`dns.lookup`) | Same |
| Load balancing | Scan DynamoDB, count per pod, pick min | Query PostgreSQL, same algorithm |
| Terminal runtime | Separate Python pod (WebSocket :8080) | Worker thread in same process |
| Internal routing | API -> Python pod WS | Pod -> Pod internal WS |
| TTL cleanup | DynamoDB TTL (24h) | Application-level cleanup on pod exit |
| Failover | DNS check + DynamoDB reassign | DNS check + PostgreSQL reassign |

## Self-Pod IP Detection

Each pod needs to know its own IP to detect "session is on this pod" (local fast path). In Kubernetes, inject via the Downward API:

```yaml
env:
  - name: POD_IP
    valueFrom:
      fieldRef:
        fieldPath: status.podIP
```

In local dev, defaults to `127.0.0.1`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `POD_IP` | `127.0.0.1` | This pod's IP (injected by K8s Downward API) |
| `TN3270_HOST` | `localhost` | Headless service name for pod discovery |
| `MAX_WORKERS` | `50` | Max Worker threads per pod |
| `INTERNAL_WS_PATH` | `/internal/terminal` | Internal pod-to-pod WS path |

## OpenShift Services

Two services are needed:

```yaml
# Regular service for external traffic (OpenShift Route → this)
apiVersion: v1
kind: Service
metadata:
  name: iast-server
spec:
  selector:
    app: iast-server
  ports:
    - port: 3000
---
# Headless service for pod discovery (DNS returns individual pod IPs)
apiVersion: v1
kind: Service
metadata:
  name: iast-server-headless
spec:
  clusterIP: None
  selector:
    app: iast-server
  ports:
    - port: 3000
```

The regular Service is used by the OpenShift Route for external traffic. The headless Service is used internally by pods to discover each other's IPs.
