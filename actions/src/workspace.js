/**
 * Where a step starts a new conversation when its data names no session: the
 * workspace whose sessions were active most recently (the same fallback the
 * Web UI uses for New Session), from the public workspace and session lists.
 * Pure.
 * @param {{ items: { workspaceId: string, sessionIds: string[], createdAt: string }[] }} workspaces
 * @param {Record<string, { updatedAt: number }>} sessionsById
 * @returns {string | undefined}
 */
export function recentWorkspace(workspaces, sessionsById) {
  let best
  let bestTime = Number.NEGATIVE_INFINITY
  for (const workspace of workspaces.items ?? []) {
    let latest = Number.NEGATIVE_INFINITY
    for (const id of workspace.sessionIds ?? []) latest = Math.max(latest, sessionsById?.[id]?.updatedAt ?? Number.NEGATIVE_INFINITY)
    if (latest === Number.NEGATIVE_INFINITY) latest = Date.parse(workspace.createdAt) || 0
    if (best === undefined || latest > bestTime) {
      best = workspace.workspaceId
      bestTime = latest
    }
  }
  return best
}
