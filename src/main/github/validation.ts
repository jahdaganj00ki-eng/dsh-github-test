import { isValidGitHubHost, sanitizeLabel } from '../../shared/github'

export function validateAccountInput(input: unknown): { label: string; login: string; host: string; authMethod: string; token?: string; sshKeyPath?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige Kontodaten')
  const obj = input as Record<string, unknown>
  const label = typeof obj.label === 'string' ? sanitizeLabel(obj.label) : ''
  if (!label) throw new Error('Label ist erforderlich')
  const login = typeof obj.login === 'string' ? obj.login.trim() : ''
  if (!login) throw new Error('GitHub-Benutzername ist erforderlich')
  const host = typeof obj.host === 'string' ? obj.host.trim().toLowerCase() : 'github.com'
  if (!isValidGitHubHost(host)) throw new Error('Ungültiger GitHub-Host')
  const authMethod = typeof obj.authMethod === 'string' ? obj.authMethod : 'pat'
  const allowed = new Set(['pat', 'oauth', 'ssh', 'gh-cli', 'ghe-pat', 'app-token'])
  if (!allowed.has(authMethod)) throw new Error('Ungültige Auth-Methode')
  const token = typeof obj.token === 'string' ? obj.token.trim() : undefined
  const sshKeyPath = typeof obj.sshKeyPath === 'string' ? obj.sshKeyPath.trim() : undefined
  return { label, login, host, authMethod, token, sshKeyPath }
}

export function validateProjectBindingInput(input: unknown): { projectRoot: string; accountId: string; remotePolicy?: string; hostOverride?: string | null; preferredOwner?: string | null; defaultBranch?: string | null } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige Projektbindung')
  const obj = input as Record<string, unknown>
  const projectRoot = typeof obj.projectRoot === 'string' ? obj.projectRoot.trim() : ''
  if (!projectRoot) throw new Error('Projektpfad ist erforderlich')
  if (projectRoot.includes('\0')) throw new Error('Ungültiger Projektpfad')
  const accountId = typeof obj.accountId === 'string' ? obj.accountId.trim() : ''
  if (!accountId) throw new Error('Konto-ID ist erforderlich')
  const remotePolicy = typeof obj.remotePolicy === 'string' ? obj.remotePolicy : 'auto'
  if (!['auto', 'https', 'ssh'].includes(remotePolicy)) throw new Error('Ungültige Remote-Strategie')
  const hostOverride = obj.hostOverride === null || obj.hostOverride === undefined ? null : String(obj.hostOverride).trim() || null
  if (hostOverride && !isValidGitHubHost(hostOverride)) throw new Error('Ungültiger Host-Override')
  const preferredOwner = obj.preferredOwner === null || obj.preferredOwner === undefined ? null : String(obj.preferredOwner).trim() || null
  const defaultBranch = obj.defaultBranch === null || obj.defaultBranch === undefined ? null : String(obj.defaultBranch).trim() || null
  return { projectRoot, accountId, remotePolicy, hostOverride, preferredOwner, defaultBranch }
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} ist erforderlich`)
  if (value.includes('\0')) throw new Error(`${name} enthält ungültige Zeichen`)
  return value.trim()
}
