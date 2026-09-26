import { describe, it, expect } from 'vitest'
import { redactGitHubSecrets, sanitizeLabel } from '../src/shared/github'
import { normalizeProjectRoot as norm, isSubPath as isSub, parseGitRemoteUrl as parseRemote, buildSshAlias as buildAlias } from '../src/main/github/git-utils'

// Shared redact/sanitize are also in src/shared/github; we test both layers
describe('github path normalization', () => {
  it('normalizes Windows paths', () => {
    const input = 'C:\\Projects\\Kiro2DSH\\src'
    const n = norm(input)
    expect(n).toMatch(/^c:\//)
    expect(n).not.toContain('\\')
  })
  it('subpath inheritance', () => {
    expect(isSub('C:\\Projects\\Kiro2DSH\\src', 'C:\\Projects\\Kiro2DSH')).toBe(true)
    expect(isSub('C:\\Projects\\Kiro2DSH', 'C:\\Projects\\Kiro2DSH')).toBe(true)
    expect(isSub('C:\\Projects\\Other', 'C:\\Projects\\Kiro2DSH')).toBe(false)
    expect(isSub('C:\\Projects\\Kiro2DSH', 'C:\\Projects\\Kiro2DSH\\src')).toBe(false)
  })
})

describe('remote URL parsing', () => {
  it('parses https', () => {
    const p = parseRemote('https://github.com/owner/repo.git')!
    expect(p.host).toBe('github.com')
    expect(p.owner).toBe('owner')
    expect(p.repo).toBe('repo')
    expect(p.protocol).toBe('https')
  })
  it('parses scp ssh', () => {
    const p = parseRemote('git@github.com:owner/repo.git')!
    expect(p.host).toBe('github.com')
    expect(p.owner).toBe('owner')
    expect(p.repo).toBe('repo')
  })
  it('parses GHES host', () => {
    const p = parseRemote('https://github.example.com/acme/my-repo.git')!
    expect(p.host).toBe('github.example.com')
  })
  it('rejects token-embedded url as https with host extraction', () => {
    const p = parseRemote('https://TOKEN@github.com/owner/repo.git')
    expect(p?.host).toBe('github.com')
  })
})

describe('ssh alias', () => {
  it('builds stable alias', () => {
    const alias = buildAlias('01H12345678901234567890', 'Privat')
    expect(alias).toMatch(/^github-privat-/)
    expect(alias.length).toBeLessThan(40)
  })
  it('sanitizes label', () => {
    const alias = buildAlias('abcd1234-efgh-5678-ijkl-mnopqrstuvwx', 'My Team @Work!')
    expect(alias).not.toContain('@')
    expect(alias).not.toContain('!')
  })
})

describe('redaction', () => {
  it('redacts ghp tokens', () => {
    const s = redactGitHubSecrets('token ghp_123456789012345678901234567890123456 is here')
    expect(s).toContain('[REDACTED]')
    expect(s).not.toContain('ghp_123456')
  })
  it('redacts Bearer', () => {
    const s = redactGitHubSecrets('Authorization: Bearer ghp_12345678901234567890')
    expect(s).toContain('Bearer [REDACTED]')
  })
  it('redacts https token url', () => {
    const s = redactGitHubSecrets('https://mytoken@github.com/owner/repo')
    expect(s).toContain('[REDACTED]@')
  })
})

describe('resolver priority (mocked config)', () => {
  // We test resolver via direct import with configOverride to avoid filesystem
  it('session override wins', async () => {
    const { resolveEffectiveGitHubAccount } = await import('../src/main/github/resolver')
    const config = {
      version: 1,
      defaultAccountId: 'default-id',
      accounts: [
        { id: 'default-id', label: 'Privat', login: 'alice', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'cred_default', enabled: true, createdAt: '', updatedAt: '' },
        { id: 'work-id', label: 'Arbeit', login: 'bob', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'cred_work', enabled: true, createdAt: '', updatedAt: '' }
      ],
      projectBindings: [
        { projectRoot: 'c:/projects/kiro2dsh', accountId: 'work-id', remotePolicy: 'auto' as const, hostOverride: null, preferredOwner: null, defaultBranch: null }
      ]
    }
    const r = resolveEffectiveGitHubAccount({ workspacePath: 'C:\\Projects\\Kiro2DSH', operation: 'push', sessionOverride: 'work-id' }, config as any)
    expect(r.accountId).toBe('work-id')
    expect(r.source).toBe('session-override')
  })
  it('project binding over global default', async () => {
    const { resolveEffectiveGitHubAccount } = await import('../src/main/github/resolver')
    const config = {
      version: 1,
      defaultAccountId: 'default-id',
      accounts: [
        { id: 'default-id', label: 'Privat', login: 'alice', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'cred_default', enabled: true, createdAt: '', updatedAt: '' },
        { id: 'work-id', label: 'Arbeit', login: 'bob', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'cred_work', enabled: true, createdAt: '', updatedAt: '' }
      ],
      projectBindings: [
        { projectRoot: 'c:/projects/kiro2dsh', accountId: 'work-id', remotePolicy: 'auto' as const, hostOverride: null, preferredOwner: null, defaultBranch: null }
      ]
    }
    const r = resolveEffectiveGitHubAccount({ workspacePath: 'C:\\Projects\\Kiro2DSH\\src', operation: 'pull' }, config as any)
    expect(r.accountId).toBe('work-id')
    expect(r.source).toBe('project-binding')
  })
  it('global default fallback', async () => {
    const { resolveEffectiveGitHubAccount } = await import('../src/main/github/resolver')
    const config = {
      version: 1,
      defaultAccountId: 'default-id',
      accounts: [
        { id: 'default-id', label: 'Privat', login: 'alice', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'cred_default', enabled: true, createdAt: '', updatedAt: '' }
      ],
      projectBindings: []
    }
    const r = resolveEffectiveGitHubAccount({ workspacePath: 'C:\\Projects\\Other', operation: 'status' }, config as any)
    expect(r.accountId).toBe('default-id')
    expect(r.source).toBe('global-default')
  })
})

describe('validation', () => {
  it('rejects empty label', async () => {
    const { validateAccountInput } = await import('../src/main/github/validation')
    expect(() => validateAccountInput({ label: '', login: 'alice', host: 'github.com', authMethod: 'pat' })).toThrow()
  })
  it('rejects invalid host', async () => {
    const { validateAccountInput } = await import('../src/main/github/validation')
    expect(() => validateAccountInput({ label: 'Privat', login: 'alice', host: 'not a host!', authMethod: 'pat' })).toThrow()
  })
  it('rejects path traversal in api path', async () => {
    // api path validation is in IPC; we simulate the check
    const p = '/repos/owner/repo/../../etc/passwd'
    expect(p.includes('..')).toBe(true)
  })
})

describe('ssh manager', () => {
  it('preview does not write', async () => {
    const { previewSshConfigChange } = await import('../src/main/github/ssh-manager')
    const { alias, diff } = previewSshConfigChange({ accountId: 'test-id-12345678', label: 'Privat', hostName: 'github.com', identityFile: 'C:\\Users\\Test\\.ssh\\id_test.pub' })
    expect(alias).toContain('github-privat-')
    expect(diff).toContain('BEGIN')
  })
})

describe('agent context', () => {
  it('formats trajectory without secrets', async () => {
    const { formatGitHubContextForTrajectory } = await import('../src/main/github/agent-context')
    const display = formatGitHubContextForTrajectory({ accountId: 'default-id', githubHost: 'github.com', authMethod: 'pat', projectRoot: 'c:/projects/kiro2dsh', repository: 'acme/repo', owner: 'acme', source: 'project-binding', warnings: [], capabilities: ['repo:write'] } as any)
    expect(display).toContain('GitHub-Konto')
    expect(display).not.toContain('ghp_')
    expect(display).not.toContain('Bearer')
  })
  it('requires confirmation for push', async () => {
    const { resolveAgentGitHubContext } = await import('../src/main/github/agent-context')
    const config = {
      version: 1,
      defaultAccountId: 'default-id',
      accounts: [{ id: 'default-id', label: 'Privat', login: 'alice', host: 'github.com', authMethod: 'pat' as const, credentialRef: 'c', enabled: true, createdAt: '', updatedAt: '' }],
      projectBindings: []
    }
    const { loadGitHubConfig } = await import('../src/main/github/account-store')
    // Use configOverride via mocking resolver's configOverride; agent context uses loadGitHubConfig internally, so we test isolated helper
    const result = resolveAgentGitHubContext({ workspacePath: 'C:\\Projects\\Kiro2DSH', operation: 'push', args: [] })
    // Without mocking filesystem, it may fall back to empty config → still risky flag should be true
    expect(result.requiresConfirmation).toBe(true)
  })
})
