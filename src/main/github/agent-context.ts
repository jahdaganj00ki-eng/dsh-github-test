import type { ResolveEffectiveAccountResult } from '../../shared/github'
import { loadGitHubConfig } from './account-store'
import { resolveEffectiveGitHubAccount } from './resolver'
import { redactGitHubSecrets } from '../../shared/github'

export interface AgentGitHubContext {
  display: string
  resolved: ResolveEffectiveAccountResult
  requiresConfirmation: boolean
  confirmationReason?: string
}

const HIGH_RISK_GIT_OPS = new Set<string>(['push', 'push --force', 'branch -D', 'tag -d', 'remote'])

function isHighRiskGitRequest(operation: string, args: string[]): { risky: boolean; reason?: string } {
  if (operation === 'push') {
    if (args.includes('--force') || args.includes('-f') || args.includes('--force-with-lease')) {
      return { risky: true, reason: 'Force-Push überschreibt Remote-Historie.' }
    }
    return { risky: true, reason: 'Push schreibt in das Remote-Repository.' }
  }
  if (operation === 'branch' && args.includes('-D')) return { risky: true, reason: 'Branch-Löschung ist destruktiv.' }
  if (operation === 'tag' && args.includes('-d')) return { risky: true, reason: 'Tag-Löschung ist destruktiv.' }
  if (operation === 'remote') return { risky: true, reason: 'Remote-Änderung beeinflusst alle folgenden Git-Operationen.' }
  if (HIGH_RISK_GIT_OPS.has(operation)) return { risky: true, reason: `Git-Operation "${operation}" ist potenziell destruktiv.` }
  return { risky: false }
}

function isHighRiskApiRequest(path: string, method: string): { risky: boolean; reason?: string } {
  const normalized = path.toLowerCase()
  const m = method.toUpperCase()
  // Repository creation/deletion
  if (m === 'POST' && normalized === '/user/repos') return { risky: true, reason: 'Repository-Erstellung.' }
  if (m === 'DELETE' && /^\/repos\/[^/]+\/[^/]+$/.test(normalized)) return { risky: true, reason: 'Repository-Löschung.' }
  if (m === 'PATCH' && normalized.includes('/repos/') && (normalized.includes('/branches/') || normalized.includes('branch-protection'))) {
    return { risky: true, reason: 'Branch-Protection-Änderung.' }
  }
  // Releases
  if (m === 'POST' && normalized.includes('/releases')) return { risky: true, reason: 'Release-Erstellung.' }
  if (m === 'DELETE' && normalized.includes('/releases/')) return { risky: true, reason: 'Release-Löschung.' }
  // Workflows
  if (m === 'POST' && normalized.includes('/actions/workflows/') && normalized.includes('/dispatches')) {
    return { risky: true, reason: 'Workflow-Ausführung.' }
  }
  if (m === 'POST' && normalized.includes('/actions/runs/') && normalized.includes('/cancel')) {
    return { risky: true, reason: 'Workflow-Abbruch.' }
  }
  // Webhooks
  if (normalized.includes('/hooks')) return { risky: true, reason: 'Webhook-Änderung.' }
  // Secrets / variables
  if (normalized.includes('/actions/secrets') || normalized.includes('/actions/variables')) {
    return { risky: true, reason: 'Secrets/Variablen-Änderung.' }
  }
  return { risky: false }
}

export function formatGitHubContextForTrajectory(resolved: ResolveEffectiveAccountResult): string {
  const config = loadGitHubConfig()
  const account = resolved.accountId ? config.accounts.find(a => a.id === resolved.accountId) ?? null : null
  const label = account?.label ?? '–'
  const login = account?.login ?? '–'
  const host = resolved.githubHost ?? account?.host ?? '–'
  const source = resolved.source === 'session-override' ? 'manuell temporär'
    : resolved.source === 'project-binding' ? 'Projektzuordnung'
    : resolved.source === 'remote-match' ? 'Remote-Abgleich'
    : resolved.source === 'global-default' ? 'globaler Standard'
    : 'Auswahl erforderlich'
  const auth = resolved.authMethod ?? account?.authMethod ?? '–'
  const repository = resolved.repository ?? '–'
  const lines = [
    `GitHub-Konto: ${redactGitHubSecrets(label)}`,
    `GitHub-Benutzer: ${redactGitHubSecrets(login)}`,
    `GitHub-Host: ${redactGitHubSecrets(host)}`,
    `Projektquelle: ${source}`,
    `Authentifizierung: ${auth}`,
    `Repository: ${redactGitHubSecrets(repository)}`
  ]
  return lines.join('\n')
}

export function resolveAgentGitHubContext(input: {
  workspacePath: string
  repositoryPath?: string | null
  operation: string
  sessionOverride?: string | null
  args?: string[]
  apiPath?: string | null
  apiMethod?: string | null
}): AgentGitHubContext {
  const resolved = resolveEffectiveGitHubAccount({
    workspacePath: input.workspacePath,
    repositoryPath: input.repositoryPath ?? null,
    operation: input.operation,
    sessionOverride: input.sessionOverride ?? null
  })

  let requiresConfirmation = false
  let confirmationReason: string | undefined

  if (input.operation.startsWith('git:')) {
    const gitOp = input.operation.slice(4)
    const check = isHighRiskGitRequest(gitOp, input.args ?? [])
    requiresConfirmation = check.risky
    confirmationReason = check.reason
  } else if (input.operation.startsWith('api:')) {
    const check = isHighRiskApiRequest(input.apiPath ?? '', input.apiMethod ?? 'GET')
    requiresConfirmation = check.risky
    confirmationReason = check.reason
  } else {
    // Generic operation name like "push" – treat as git
    const check = isHighRiskGitRequest(input.operation, input.args ?? [])
    if (check.risky) {
      requiresConfirmation = true
      confirmationReason = check.reason
    }
    if (!requiresConfirmation && input.apiPath) {
      const apiCheck = isHighRiskApiRequest(input.apiPath, input.apiMethod ?? 'GET')
      requiresConfirmation = apiCheck.risky
      confirmationReason = apiCheck.reason
    }
  }

  const display = formatGitHubContextForTrajectory(resolved)
  return { display, resolved, requiresConfirmation, confirmationReason }
}

export function assertAgentAuth(resolved: ResolveEffectiveAccountResult, operation: string): void {
  if (!resolved.accountId) {
    throw Object.assign(new Error(`Kein GitHub-Konto für "${operation}" verfügbar. Bitte ein Konto hinzufügen und ggf. ein Projektkonto zuordnen.`), { code: 'GITHUB_AUTH_REQUIRED' })
  }
}
