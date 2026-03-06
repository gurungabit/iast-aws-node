# IAST AWS Node Documentation

Interactive Automated System Tasks (IAST) platform for IBM mainframe automation, deployed on ROSA (Red Hat OpenShift Service on AWS) with Amazon RDS PostgreSQL.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture Overview](./architecture.md) | High-level system architecture, ROSA deployment, and AWS service integration |
| [Session Routing](./session-routing.md) | Pod affinity, session-to-pod assignment, internal WS proxy, failover |
| [Terminal System](./terminal.md) | Worker thread architecture, TN3270 protocol, WebSocket bridging |
| [AST Engine](./ast-engine.md) | Automated System Tasks execution, progress reporting, and batching |
| [Database Schema](./database.md) | PostgreSQL schema, table relationships, indexes, and Drizzle ORM usage |
| [API Reference](./api.md) | REST endpoints, WebSocket protocol, and message types |
| [Frontend Architecture](./frontend.md) | React app structure, state management, and real-time UI updates |
| [Authentication](./authentication.md) | Azure Entra ID integration, JWT flow, and WebSocket auth |
| [Deployment](./deployment.md) | ROSA/OpenShift configuration, RDS setup, scaling, and environment variables |
| [Development Guide](./development.md) | Local setup, testing, monorepo structure, and contributing |

## Quick Start

```bash
# Prerequisites: Node.js 20+, Docker

# 1. Start PostgreSQL
npm run docker:up

# 2. Install dependencies
npm install

# 3. Copy environment config
cp packages/server/.env.example packages/server/.env

# 4. Run database migrations
npm -w packages/server run db:migrate

# 5. Start development servers
npm run dev
# Server: http://localhost:3000
# Web:    http://localhost:5173
# Swagger: http://localhost:3000/docs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TanStack Router/Query, Zustand, Tailwind CSS, xterm.js |
| Backend | Fastify 5, Node.js Worker Threads, tnz3270-node |
| Database | PostgreSQL 16 (Amazon RDS), Drizzle ORM |
| Auth | Azure Entra ID (MSAL) |
| Platform | ROSA (OpenShift on AWS), Amazon RDS, EventBridge Scheduler |
| Testing | Vitest, Playwright, Testing Library |
