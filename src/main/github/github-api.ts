import { loadGitHubConfig } from './account-store'
import { loadCredential } from './credential-store'
import { redactGitHubSecrets } from '../../shared/github'

function apiBaseForHost(host: string): string {
  const normalized = host.trim().toLowerCase()
  if (normalized === 'github.com' || normalized === 'api.github.com') return 'https://api.github.com'
  // GHES: https://<host>/api/v3
  return `https://${normalized}/api/v3`
}

export interface FetchGitHubOptions {
  accountId: string
  path: string
  method?: string
  body?: unknown
  hostOverride?: string | null
}

export async function fetchGitHubApi(options: FetchGitHubOptions): Promise<{ status: number; headers: Record<string, string>; data: unknown }> {
  const config = loadGitHubConfig()
  const account = config.accounts.find(a => a.id === options.accountId)
  if (!account) throw Object.assign(new Error('Konto nicht gefunden'), { code: 'GITHUB_ACCOUNT_NOT_FOUND' })
  const host = (options.hostOverride ?? account.host).trim()
  const base = apiBaseForHost(host)
  const token = loadCredential(account.credentialRef)
  if (!token && account.authMethod !== 'ssh' && account.authMethod !== 'gh-cli') {
    throw Object.assign(new Error('Keine Anmeldedaten für dieses Konto'), { code: 'GITHUB_AUTH_REQUIRED' })
  }
  const url = `${base}${options.path.startsWith('/') ? '' : '/'}${options.path}`
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    signal: AbortSignal.timeout(15000)
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw Object.assign(new Error(redactGitHubSecrets(`GitHub-Host nicht erreichbar: ${msg}`)), { code: 'GITHUB_HOST_UNREACHABLE', host })
  }
  const text = await response.text()
  let data: unknown
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  const headerMap: Record<string, string> = {}
  response.headers.forEach((value, key) => { headerMap[key.toLowerCase()] = value })
  if (!response.ok) {
    const message = redactGitHubSecrets(typeof data === 'object' && data && 'message' in (data as Record<string, unknown>) ? String((data as Record<string, unknown>).message) : `GitHub API Fehler ${response.status}`)
    const code = response.status === 401 ? 'GITHUB_AUTH_EXPIRED' : response.status === 403 ? 'GITHUB_PERMISSION_DENIED' : response.status === 404 ? 'GITHUB_REPOSITORY_NOT_FOUND' : 'GITHUB_HOST_UNREACHABLE'
    throw Object.assign(new Error(message), { code, status: response.status, host, data })
  }
  return { status: response.status, headers: headerMap, data }
}

export async function testGitHubConnection(accountId: string): Promise<{ ok: boolean; login?: string; scopes?: string[]; message: string; code?: string }> {
  try {
    const result = await fetchGitHubApi({ accountId, path: '/user' })
    const scopesHeader = result.headers['x-oauth-scopes'] ?? result.headers['x-accepted-oauth-scopes'] ?? ''
    const scopes = scopesHeader ? scopesHeader.split(',').map(s => s.trim()).filter(Boolean) : undefined
    const login = (result.data as { login?: string })?.login
    // Optionally update stored metadata
    return { ok: true, login, scopes, message: 'Verbindung erfolgreich.' }
  } catch (error) {
    const err = error as Error & { code?: string }
    return { ok: false, message: redactGitHubSecrets(err.message || 'Verbindung fehlgeschlagen.'), code: err.code }
  }
}
