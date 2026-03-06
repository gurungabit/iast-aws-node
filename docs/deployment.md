# Deployment

## Overview

The application deploys to **ROSA** (Red Hat OpenShift Service on AWS) with **Amazon RDS** for PostgreSQL. The server pods run Fastify with Worker threads for TN3270 sessions, while web pods serve the static React SPA.

## Infrastructure Diagram

```mermaid
graph TB
    subgraph "AWS Account"
        subgraph "VPC"
            subgraph "ROSA Cluster"
                subgraph "iast Namespace"
                    WEB_DEP[Deployment: web]
                    SRV_DEP[Deployment: server]
                    WEB_SVC[Service: web :8080]
                    SRV_SVC[Service: server :3000]
                    WEB_ROUTE[Route: iast.apps.rosa...]
                    API_ROUTE[Route: iast-api.apps.rosa...]
                    HPA_SRV[HPA: server]
                    HPA_WEB[HPA: web]
                    CM[ConfigMap: iast-config]
                    SECRET[Secret: iast-secrets]
                end
            end

            subgraph "Private Subnets"
                RDS[(RDS PostgreSQL 16<br/>Multi-AZ)]
            end

            subgraph "AWS Services"
                EB[EventBridge Scheduler]
                SM[Secrets Manager]
                ECR[ECR Registry]
            end
        end

        subgraph "Enterprise Network (VPN/DirectConnect)"
            MF[IBM Mainframe<br/>TN3270 :1023]
            DB2[(DB2)]
            SMB_SHARE[SMB File Share]
        end
    end

    subgraph "Azure"
        ENTRA[Azure Entra ID]
    end

    WEB_ROUTE --> WEB_SVC --> WEB_DEP
    API_ROUTE --> SRV_SVC --> SRV_DEP
    SRV_DEP --> RDS
    SRV_DEP --> MF
    SRV_DEP --> DB2
    SRV_DEP --> SMB_SHARE
    SRV_DEP --> EB
    SRV_DEP --> SM
    SRV_DEP -.-> ENTRA
    WEB_DEP -.-> ENTRA
    HPA_SRV -.-> SRV_DEP
    HPA_WEB -.-> WEB_DEP
    ECR -.->|pull images| WEB_DEP & SRV_DEP
    CM -.-> SRV_DEP
    SECRET -.-> SRV_DEP
```

## OpenShift Resources

### Web Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iast-web
  namespace: iast
spec:
  replicas: 2
  selector:
    matchLabels:
      app: iast-web
  template:
    metadata:
      labels:
        app: iast-web
    spec:
      containers:
        - name: web
          image: <ECR_REGISTRY>/iast-web:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "200m"
              memory: "128Mi"
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 10
```

### Server Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iast-server
  namespace: iast
spec:
  replicas: 2
  selector:
    matchLabels:
      app: iast-server
  template:
    metadata:
      labels:
        app: iast-server
    spec:
      containers:
        - name: server
          image: <ECR_REGISTRY>/iast-server:latest
          ports:
            - containerPort: 3000
          env:
            - name: POD_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.podIP
          envFrom:
            - configMapRef:
                name: iast-config
            - secretRef:
                name: iast-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
          livenessProbe:
            httpGet:
              path: /ping
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
```

### Services

```yaml
apiVersion: v1
kind: Service
metadata:
  name: iast-web
spec:
  selector:
    app: iast-web
  ports:
    - port: 8080
      targetPort: 8080
---
# Regular service for external traffic (OpenShift Route targets this)
apiVersion: v1
kind: Service
metadata:
  name: iast-server
spec:
  selector:
    app: iast-server
  ports:
    - port: 3000
      targetPort: 3000
---
# Headless service for pod discovery (DNS returns individual pod IPs)
# Used by the session routing system to discover all server pods
# and proxy WebSocket connections to the pod that owns a session.
# See docs/session-routing.md for details.
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

### Routes (OpenShift-specific)

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: iast-web
spec:
  host: iast.apps.rosa.example.com
  to:
    kind: Service
    name: iast-web
  tls:
    termination: edge
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: iast-api
spec:
  host: iast-api.apps.rosa.example.com
  to:
    kind: Service
    name: iast-server
  tls:
    termination: edge
```

Note: WebSocket connections require the route to support upgrade. OpenShift routes handle this natively with `tls.termination: edge`.

### HorizontalPodAutoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: iast-server
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: iast-server
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Pods
      pods:
        metric:
          name: iast_worker_utilization
        target:
          type: AverageValue
          averageValue: "70"
```

The custom metric `iast_worker_utilization` is derived from the `/metrics` endpoint:
```
utilization = (activeWorkers / maxWorkers) * 100
```

A Prometheus ServiceMonitor scrapes `/metrics` and feeds the HPA.

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: iast-config
data:
  PORT: "3000"
  HOST: "0.0.0.0"
  TN3270_HOST: "mainframe.internal.example.com"
  TN3270_PORT: "1023"
  TN3270_SECURE: "true"
  MAX_WORKERS: "50"
  AWS_REGION: "us-east-1"
  SECRETS_PREFIX: "iast/"
  ENTRA_TENANT_ID: "<tenant-id>"
  ENTRA_CLIENT_ID: "<client-id>"
  ENTRA_AUDIENCE: "<audience>"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: iast-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgres://iast:<password>@iast-db.xxxx.us-east-1.rds.amazonaws.com:5432/iast?sslmode=require"
  ENCRYPTION_KEY: "<32-byte-hex-key>"
  EVENTBRIDGE_ROLE_ARN: "arn:aws:iam::xxxx:role/iast-eventbridge-role"
  SCHEDULE_TARGET_ARN: "arn:aws:lambda:us-east-1:xxxx:function:iast-schedule-trigger"
```

## Amazon RDS Setup

### Instance Configuration

| Setting | Production | Development |
|---------|-----------|-------------|
| Engine | PostgreSQL 16 | PostgreSQL 16 (Docker) |
| Instance class | `db.r6g.large` | N/A |
| Storage | gp3, 100 GB, auto-scaling | Docker volume |
| Multi-AZ | Yes | No |
| Backup retention | 7 days | N/A |
| Encryption | AES-256 (KMS) | N/A |
| VPC Security Group | Allow :5432 from ROSA worker nodes | N/A |
| Parameter Group | `max_connections=200` | Default |
| SSL | Required (`sslmode=require`) | Optional |

### Network Access

The RDS instance sits in private subnets within the same VPC as the ROSA cluster. Security group rules:

```
Inbound: TCP 5432 from ROSA worker node security group
Outbound: Default (allow all)
```

### Connection String Format

```
postgres://iast:<password>@<rds-endpoint>:5432/iast?sslmode=require
```

## Container Images

### Server Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN npm ci --workspace=packages/server --workspace=packages/shared
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
RUN npm -w packages/server run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Web Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN npm ci --workspace=packages/web --workspace=packages/shared
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
RUN npm -w packages/web run build

FROM nginx:alpine
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `postgres://iast:iast_dev@localhost:5432/iast` | PostgreSQL connection string |
| `PORT` | No | `3000` | Server listen port |
| `HOST` | No | `0.0.0.0` | Server bind address |
| `POD_IP` | No | `127.0.0.1` | This pod's IP (K8s Downward API). Used for session routing. |
| `ENTRA_TENANT_ID` | Yes | | Azure Entra tenant GUID |
| `ENTRA_CLIENT_ID` | Yes | | App registration client ID |
| `ENTRA_AUDIENCE` | No | | JWT audience (defaults to client ID) |
| `TN3270_HOST` | Yes | `localhost` | Mainframe hostname |
| `TN3270_PORT` | No | `3270` | Mainframe TN3270 port |
| `TN3270_SECURE` | No | `true` | Use TLS for TN3270 |
| `MAX_WORKERS` | No | `50` | Max worker threads per pod |
| `ENCRYPTION_KEY` | Yes | | AES-256 key for credential encryption |
| `AWS_REGION` | No | | AWS region for EventBridge/Secrets Manager |
| `EVENTBRIDGE_ROLE_ARN` | No | | IAM role ARN for EventBridge |
| `SCHEDULE_TARGET_ARN` | No | | Lambda/target ARN for schedule triggers |
| `SECRETS_PREFIX` | No | `iast/` | AWS Secrets Manager key prefix |

## Monitoring & Observability

### Health Endpoints

| Endpoint | Use | Response |
|----------|-----|----------|
| `GET /ping` | Liveness probe | `{ pong: true }` |
| `GET /health` | Readiness probe | `{ status, timestamp, db }` |
| `GET /metrics` | HPA + monitoring | `{ activeWorkers, maxWorkers }` |

### Prometheus Metrics

Configure a ServiceMonitor to scrape `/metrics`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: iast-server
spec:
  selector:
    matchLabels:
      app: iast-server
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### Logging

Fastify's built-in Pino logger outputs structured JSON to stdout:
```json
{"level":30,"time":1709712000000,"msg":"Server listening","address":"0.0.0.0","port":3000}
```

Collected by OpenShift's cluster logging (Elasticsearch/Fluentd/Kibana stack or Loki).

### Alerts (Recommended)

| Alert | Condition | Severity |
|-------|-----------|----------|
| High worker utilization | `activeWorkers/maxWorkers > 0.9` for 5m | Warning |
| Health degraded | `/health` returns `status: degraded` | Critical |
| Pod restart loop | Restart count > 3 in 10m | Critical |
| RDS high connections | Active connections > 80% of max | Warning |
| RDS high CPU | CPU > 80% for 10m | Warning |
