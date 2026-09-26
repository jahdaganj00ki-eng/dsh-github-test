import { existsSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'

export function normalizeProjectRoot(input: string): string {
  const resolved = resolve(input.trim())
  let canonical = resolved
  try {
    canonical = realpathSync(resolved)
  } catch {
    canonical = resolved
  }
  // Windows: lowercase drive, forward slashes, trim trailing slash
  canonical = canonical.replaceAll('\\', '/')
  if (/^[A-Za-z]:\//.test(canonical)) {
    canonical = canonical[0]!.toLowerCase() + canonical.slice(1)
  }
  if (canonical.length > 3 && canonical.endsWith('/')) canonical = canonical.slice(0, -1)
  return canonical
}

export function isSubPath(child: string, parent: string): boolean {
  const c = normalizeProjectRoot(child)
  const p = normalizeProjectRoot(parent)
  if (c === p) return true
  return c.startsWith(p + '/')
}

export function resolveGitRoot(startPath: string): string | null {
  const start = isAbsolute(startPath) ? startPath : resolve(startPath)
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: start,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    }).trim()
    if (!out) return null
    // git returns native path; normalize
    return normalizeProjectRoot(out)
  } catch {
    return null
  }
}

export interface ParsedRemote {
  host: string
  owner: string
  repo: string
  original: string
  protocol: 'https' | 'ssh' | 'unknown'
}

export function parseGitRemoteUrl(remoteUrl: string): ParsedRemote | null {
  const raw = remoteUrl.trim()
  if (!raw) return null
  // https://github.com/owner/repo(.git)
  const httpsMatch = /^https?:\/\/([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(raw)
  if (httpsMatch) {
    return {
      host: httpsMatch[1]!.toLowerCase(),
      owner: httpsMatch[2]!,
      repo: httpsMatch[3]!,
      original: raw,
      protocol: 'https'
    }
  }
  // git@github.com:owner/repo(.git)  or ssh://git@github.com/owner/repo
  const scpMatch = /^(?:git@|ssh:\/\/git@)([^:/]+)[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(raw)
  if (scpMatch) {
    return {
      host: scpMatch[1]!.toLowerCase(),
      owner: scpMatch[2]!,
      repo: scpMatch[3]!,
      original: raw,
      protocol: 'ssh'
    }
  }
  // https with token embedded: https://TOKEN@github.com/owner/repo
  const tokenHttps = /^https:\/\/[^@]+@([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(raw)
  if (tokenHttps) {
    return {
      host: tokenHttps[1]!.toLowerCase(),
      owner: tokenHttps[2]!,
      repo: tokenHttps[3]!,
      original: raw,
      protocol: 'https'
    }
  }
  return null
}

export function getGitRemoteUrl(gitRoot: string, remoteName = 'origin'): string | null {
  try {
    const out = execFileSync('git', ['config', '--get', `remote.${remoteName}.url`], {
      cwd: gitRoot,
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    }).trim()
    return out || null
  } catch {
    return null
  }
}

export function githubHostFromRemote(remote: ParsedRemote | null): string | null {
  return remote?.host ?? null
}

export function isGitHubDotCom(host: string): boolean {
  return host.toLowerCase() === 'github.com'
}

export function buildSshAlias(accountId: string, label: string): string {
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 16) || 'gh'
  const short = accountId.slice(0, 8)
  return `github-${safeLabel}-${short}`
}

export function detectGitHubCliAvailable(): boolean {
  try {
    execFileSync('gh', ['--version'], { encoding: 'utf8', timeout: 3000, windowsHide: true })
    return true
  } catch {
    return false
  }
}

export function detectGhCliAuthStatus(): { available: boolean; authenticated: boolean; message: string } {
  try {
    execFileSync('gh', ['--version'], { encoding: 'utf8', timeout: 3000, windowsHide: true })
  } catch {
    return { available: false, authenticated: false, message: 'GitHub CLI nicht installiert' }
  }
  try {
    const out = execFileSync('gh', ['auth', 'status'], { encoding: 'utf8', timeout: 5000, windowsHide: true }).trim()
    const authenticated = out.toLowerCase().includes('logged in') || out.toLowerCase().includes('authenticated')
    return { available: true, authenticated, message: out.slice(0, 500) }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // gh auth status exits non-zero when not logged in, but still prints status
    const stderr = (error as { stderr?: string })?.stderr ?? msg
    const authenticated = false
    return { available: true, authenticated, message: String(stderr).slice(0, 500) }
  }
}

export function detectSshAvailable(): { available: boolean; message: string } {
  try {
    execFileSync('ssh', ['-V'], { encoding: 'utf8', timeout: 3000, windowsHide: true })
    return { available: true, message: 'SSH verfügbar' }
  } catch (error) {
    // ssh -V writes to stderr and exits non-zero on some platforms, so try -T probe
    try {
      execFileSync('ssh', [], { encoding: 'utf8', timeout: 3000, windowsHide: true })
      return { available: true, message: 'SSH verfügbar' }
    } catch {
      const msg = error instanceof Error ? error.message : String(error)
      return { available: false, message: msg.slice(0, 300) }
    }
  }
}

export function validateWorkspacePath(input: unknown): string {
  if (typeof input !== 'string' || !input.trim()) throw new Error('workspacePath must be a non-empty string')
  const trimmed = input.trim()
  if (trimmed.includes('\0')) throw new Error('Invalid workspace path')
  if (trimmed.length > 1024) throw new Error('Workspace path too long')
  // Prevent path traversal via .. segments that escape after resolve is too late for check;
  // we validate the raw contains no null bytes and is not excessively long, actual containment
  // is checked after normalization where needed.
  return trimmed
}
