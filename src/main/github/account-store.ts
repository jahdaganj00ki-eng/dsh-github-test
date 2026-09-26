import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import type { GitHubAccount, GitHubConfig, GitHubProjectBinding } from '../../shared/github'
import { GITHUB_CONFIG_VERSION } from '../../shared/github'

const CONFIG_FILE = 'github-accounts.json'
const CREDENTIALS_FILE = 'github-credentials.enc.json'

function githubDir(): string {
  return join(app.getPath('userData'), 'github')
}

export function githubConfigPath(): string {
  return join(githubDir(), CONFIG_FILE)
}

export function githubCredentialsPath(): string {
  return join(githubDir(), CREDENTIALS_FILE)
}

function defaultConfig(): GitHubConfig {
  return {
    version: GITHUB_CONFIG_VERSION,
    defaultAccountId: null,
    accounts: [],
    projectBindings: []
  }
}

function migrateConfig(raw: unknown): GitHubConfig {
  const base = defaultConfig()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const obj = raw as Record<string, unknown>
  const version = typeof obj.version === 'number' ? obj.version : 0
  // Future migrations: switch on version
  if (version === 0) {
    return base
  }
  const accounts = Array.isArray(obj.accounts) ? (obj.accounts as GitHubAccount[]) : []
  const projectBindings = Array.isArray(obj.projectBindings) ? (obj.projectBindings as GitHubProjectBinding[]) : []
  const defaultAccountId = typeof obj.defaultAccountId === 'string' ? obj.defaultAccountId : null
  return {
    version: GITHUB_CONFIG_VERSION,
    defaultAccountId: defaultAccountId && accounts.some(a => a.id === defaultAccountId) ? defaultAccountId : (accounts[0]?.id ?? null),
    accounts: accounts.filter(a => a && typeof a.id === 'string' && typeof a.login === 'string'),
    projectBindings: projectBindings.filter(b => b && typeof b.projectRoot === 'string' && typeof b.accountId === 'string')
  }
}

function atomicWriteJson(filePath: string, value: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
    renameSync(tmp, filePath)
  } finally {
    if (existsSync(tmp)) {
      try { unlinkSync(tmp) } catch {}
    }
  }
}

export function loadGitHubConfig(): GitHubConfig {
  const path = githubConfigPath()
  if (!existsSync(path)) return defaultConfig()
  try {
    const raw = readFileSync(path, 'utf8').trim()
    if (!raw) return defaultConfig()
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.version === 'number' && parsed.version !== GITHUB_CONFIG_VERSION) {
      const migrated = migrateConfig(parsed)
      // Backup corrupt/future version before overwriting
      try {
        const backup = `${path}.bak.${Date.now()}`
        writeFileSync(backup, raw, 'utf8')
      } catch {}
      saveGitHubConfig(migrated)
      return migrated
    }
    return migrateConfig(parsed)
  } catch {
    // Corrupt file -> backup and reset
    try {
      const raw = readFileSync(path, 'utf8')
      writeFileSync(`${path}.bak.${Date.now()}`, raw, 'utf8')
    } catch {}
    const fresh = defaultConfig()
    try { saveGitHubConfig(fresh) } catch {}
    return fresh
  }
}

export function saveGitHubConfig(config: GitHubConfig): void {
  const normalized: GitHubConfig = {
    version: GITHUB_CONFIG_VERSION,
    defaultAccountId: config.defaultAccountId,
    accounts: config.accounts,
    projectBindings: config.projectBindings
  }
  atomicWriteJson(githubConfigPath(), normalized)
}

export function createAccountId(): string {
  return randomUUID()
}

export function createCredentialRef(accountId: string): string {
  return `cred_${accountId}`
}
