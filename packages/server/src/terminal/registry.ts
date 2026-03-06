// ============================================================================
// Session Registry - PostgreSQL + Headless Service Pod Discovery
//
// Tracks which pod IP owns each terminal session. Enables cross-pod routing
// without sticky load balancers. Ported from iast-aws DynamoDB-based registry.
// ============================================================================

import { lookup } from 'node:dns/promises'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { sessionAssignments } from '../db/schema/session-assignments.js'
import { config } from '../config.js'

export interface SessionAssignment {
  podIp: string
  userId: string
  status: 'active' | 'terminated'
}

/**
 * Discover server pod IPs via DNS lookup of the headless service.
 *
 * With a headless K8s Service (clusterIP: None), DNS returns individual pod IPs
 * as A records. This lets any pod discover all other pods for direct routing.
 *
 * In local dev (no HEADLESS_SERVICE_HOST), returns [config.podIp] for
 * single-instance behavior.
 */
export async function discoverPods(): Promise<string[]> {
  const serviceHost = config.headlessServiceHost
  if (!serviceHost) return [config.podIp]

  try {
    // dns.lookup (NOT dns.resolve4) uses OS resolver which respects
    // /etc/resolv.conf search domains. In K8s, short service names like
    // 'iast-aws-node-headless-dev' auto-expand to FQDN.
    const results = await lookup(serviceHost, { all: true, family: 4 })
    const addresses = results.map((r) => r.address)
    return addresses.length > 0 ? addresses : [config.podIp]
  } catch {
    return [config.podIp]
  }
}

/**
 * Check whether a pod IP is alive by verifying it appears in DNS results.
 */
export async function isPodAlive(podIp: string, prefetchedPods?: string[]): Promise<boolean> {
  const activePods = prefetchedPods ?? (await discoverPods())
  return activePods.includes(podIp)
}

/**
 * Look up which pod owns a session.
 */
export async function getSessionAssignment(sessionId: string): Promise<SessionAssignment | null> {
  const rows = await db
    .select({
      podIp: sessionAssignments.podIp,
      userId: sessionAssignments.userId,
      status: sessionAssignments.status,
    })
    .from(sessionAssignments)
    .where(eq(sessionAssignments.sessionId, sessionId))
    .limit(1)

  if (rows.length === 0) return null

  return {
    podIp: rows[0].podIp,
    userId: rows[0].userId,
    status: rows[0].status as 'active' | 'terminated',
  }
}

/**
 * Register a session → pod assignment.
 * Uses upsert (ON CONFLICT UPDATE) so reconnects update the assignment.
 */
export async function registerSessionAssignment(
  sessionId: string,
  podIp: string,
  userId: string,
): Promise<void> {
  await db
    .insert(sessionAssignments)
    .values({
      sessionId,
      podIp,
      userId,
      status: 'active',
    })
    .onConflictDoUpdate({
      target: sessionAssignments.sessionId,
      set: {
        podIp,
        userId,
        status: 'active',
        updatedAt: new Date(),
      },
    })
}

/**
 * Mark a session assignment as terminated.
 */
export async function terminateSessionAssignment(sessionId: string): Promise<void> {
  await db
    .update(sessionAssignments)
    .set({ status: 'terminated', updatedAt: new Date() })
    .where(eq(sessionAssignments.sessionId, sessionId))
}

/**
 * Mark all sessions on a dead pod as terminated.
 */
export async function terminatePodSessions(podIp: string): Promise<void> {
  await db
    .update(sessionAssignments)
    .set({ status: 'terminated', updatedAt: new Date() })
    .where(
      and(
        eq(sessionAssignments.podIp, podIp),
        eq(sessionAssignments.status, 'active'),
      ),
    )
}

/**
 * Get the least-loaded pod for new session assignment.
 *
 * 1. Discovers available pods via DNS (headless service)
 * 2. Queries PostgreSQL for active session counts per pod
 * 3. Returns the pod with fewest active sessions
 * 4. Breaks ties randomly to avoid thundering herd
 */
export async function getLeastLoadedPod(prefetchedPods?: string[]): Promise<string> {
  const pods = prefetchedPods ?? (await discoverPods())

  if (pods.length <= 1) return pods[0]

  const counts = await db
    .select({
      podIp: sessionAssignments.podIp,
      count: sql<number>`count(*)::int`,
    })
    .from(sessionAssignments)
    .where(eq(sessionAssignments.status, 'active'))
    .groupBy(sessionAssignments.podIp)

  const countMap = new Map(counts.map((r) => [r.podIp, r.count]))

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

  return candidates[Math.floor(Math.random() * candidates.length)]
}
