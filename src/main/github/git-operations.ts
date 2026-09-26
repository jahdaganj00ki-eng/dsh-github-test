import { spawn } from 'node:child_process'
import { loadGitHubConfig } from './account-store'
import { loadCredential } from './credential-store'
import { resolveEffectiveGitHubAccount } from './resolver'
import { redactGitHubSecrets } from '../../shared/github'

export type GitOperation = 'status' | 'clone' | 'fetch' | 'pull' | 'push' | 'branch' | 'checkout' | 'switch' | 'merge' | 'rebase' | 'tag' | 'remote' | 'log' | 'diff' | 'stash' | 'init'

const DESTRUCTIVE_OPS = new Set<string>(['push', 'push --force', 'branch -D', 'tag -d'])

export interface GitOperationRequest {
  operation: GitOperation
  args: string[]
  cwd: string
  workspacePath: string
  accountId?: string | null
  confirmDestructive?: boolean
}

export interface GitOperationResult {
  exitCode: number
  stdout: string
  stderr: string
  accountId: string | null
  githubHost: string | null
}

function buildGitEnv(accountId: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  if (!accountId) return env
  const config = loadGitHubConfig()
  const account = config.accounts.find(a => a.id === accountId)
  if (!account) return env
  if (account.authMethod === 'ssh') {
    // SSH alias handling is done via GIT_SSH_COMMAND if credentialRef stores key path meta
    // For now, leave default ssh; managed alias via config file is handled elsewhere.
  } else {
    const token = loadCredential(account.credentialRef)
    if (token) {
      // Use GIT_ASKPASS approach: inject via env for HTTPS. We set a temporary askpass that echoes token.
      // Simpler: set GITHUB_TOKEN env for credential helper that reads it.
      env.GITHUB_TOKEN = token
      env.GH_TOKEN = token
    }
  }
  return env
}

export function runGitOperation(request: GitOperationRequest): Promise<GitOperationResult> {
  const needsConfirm = DESTRUCTIVE_OPS.has(request.operation) || request.args.includes('--force') || request.args.includes('-f')
  if (needsConfirm && !request.confirmDestructive) {
    return Promise.reject(Object.assign(new Error('Destruktive Aktion erfordert Bestätigung.'), { code: 'GITHUB_DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION' }))
  }

  // Resolve effective account if not explicitly provided
  let resolvedAccountId = request.accountId ?? null
  let githubHost: string | null = null
  if (!resolvedAccountId) {
    const resolved = resolveEffectiveGitHubAccount({
      workspacePath: request.workspacePath,
      repositoryPath: request.cwd,
      operation: request.operation
    })
    resolvedAccountId = resolved.accountId
    githubHost = resolved.githubHost
    if (!resolvedAccountId && (request.operation === 'push' || request.operation === 'pull' || request.operation === 'fetch' || request.operation === 'clone')) {
      return Promise.reject(Object.assign(new Error('Kein GitHub-Konto für diese Operation verfügbar.'), { code: 'GITHUB_AUTH_REQUIRED' }))
    }
  } else {
    const config = loadGitHubConfig()
    const acc = config.accounts.find(a => a.id === resolvedAccountId)
    githubHost = acc?.host ?? null
  }

  const env = buildGitEnv(resolvedAccountId)
  const gitArgs = [request.operation, ...request.args].filter(Boolean)

  return new Promise((resolve, reject) => {
    const child = spawn('git', gitArgs, {
      cwd: request.cwd,
      env,
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (error) => {
      reject(Object.assign(new Error(redactGitHubSecrets(error.message)), { code: 'GITHUB_HOST_UNREACHABLE' }))
    })
    child.on('close', (code) => {
      const redactedStdout = redactGitHubSecrets(stdout)
      const redactedStderr = redactGitHubSecrets(stderr)
      resolve({
        exitCode: code ?? 0,
        stdout: redactedStdout,
        stderr: redactedStderr,
        accountId: resolvedAccountId,
        githubHost
      })
    })
  })
}
