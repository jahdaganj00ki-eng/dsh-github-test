export const GITHUB_CONFIG_VERSION = 1 as const

export type GitHubAuthMethod =
  | 'pat'
  | 'oauth'
  | 'ssh'
  | 'gh-cli'
  | 'ghe-pat'
  | 'app-token'

export type GitHubRemotePolicy = 'auto' | 'https' | 'ssh'

export type GitHubAccountSource =
  | 'session-override'
  | 'project-binding'
  | 'remote-match'
  | 'global-default'
  | 'interactive-required'

export interface GitHubAccount {
  id: string
  label: string
  login: string
  displayName?: string
  avatarUrl?: string
  host: string
  authMethod: GitHubAuthMethod
  credentialRef: string
  enabled: boolean
  createdAt: string
  updatedAt: string
  scopes?: string[]
  organizations?: string[]
}

export interface GitHubProjectBinding {
  projectRoot: string
  accountId: string
  remotePolicy: GitHubRemotePolicy
  hostOverride?: string | null
  preferredOwner?: string | null
  defaultBranch?: string | null
}

export interface GitHubConfig {
  version: number
  defaultAccountId: string | null
  accounts: GitHubAccount[]
  projectBindings: GitHubProjectBinding[]
}

export interface ResolveEffectiveAccountRequest {
  workspacePath: string
  repositoryPath?: string | null
  operation: string
  sessionOverride?: string | null
}

export interface ResolveEffectiveAccountResult {
  accountId: string | null
  githubHost: string | null
  authMethod: GitHubAuthMethod | null
  projectRoot: string | null
  repository: string | null
  owner: string | null
  source: GitHubAccountSource
  warnings: string[]
  capabilities: string[]
}

export type GitHubErrorCode =
  | 'GITHUB_ACCOUNT_NOT_FOUND'
  | 'GITHUB_ACCOUNT_DISABLED'
  | 'GITHUB_AUTH_REQUIRED'
  | 'GITHUB_AUTH_EXPIRED'
  | 'GITHUB_PERMISSION_DENIED'
  | 'GITHUB_HOST_UNREACHABLE'
  | 'GITHUB_REPOSITORY_NOT_FOUND'
  | 'GITHUB_REMOTE_ACCOUNT_MISMATCH'
  | 'GITHUB_SSH_KEY_NOT_FOUND'
  | 'GITHUB_SSH_AUTH_FAILED'
  | 'GITHUB_CREDENTIAL_STORE_UNAVAILABLE'
  | 'GITHUB_OPERATION_CANCELLED'
  | 'GITHUB_DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION'
  | 'GITHUB_INVALID_INPUT'
  | 'GITHUB_CONFIG_CORRUPT'

export interface GitHubErrorDetails {
  code: GitHubErrorCode
  message: string
  accountId?: string
  host?: string
  operation?: string
  hint?: string
}

export interface GitHubConnectionTestResult {
  ok: boolean
  accountId: string
  host: string
  authMethod: GitHubAuthMethod
  login?: string
  scopes?: string[]
  errorCode?: GitHubErrorCode
  message: string
}

export interface GitHubApiRepo {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  htmlUrl: string
  defaultBranch: string
}

export function isValidGitHubHost(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 253) return false
  return /^[a-zA-Z0-9.-]+(?::\d+)?$/.test(trimmed)
}

export function isValidGitHubLogin(value: string): boolean {
  if (!value || typeof value !== 'string') return false
  return /^[a-zA-Z0-9-]{1,39}$/.test(value)
}

export function sanitizeLabel(label: string): string {
  return label.trim().slice(0, 64)
}

export const GITHUB_SENSITIVE_PATTERNS: RegExp[] = [
  /gh[oprs]_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
]

export function redactGitHubSecrets(value: string): string {
  let result = value
  for (const pattern of GITHUB_SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  result = result.replace(/(Bearer\s+)[^\s"',;]+/gi, '$1[REDACTED]')
  result = result.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@')
  return result
}
