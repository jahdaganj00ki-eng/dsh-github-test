import type { ResolveEffectiveAccountRequest, ResolveEffectiveAccountResult, GitHubConfig } from '../../shared/github'
import { loadGitHubConfig } from './account-store'
import { normalizeProjectRoot, isSubPath, resolveGitRoot, getGitRemoteUrl, parseGitRemoteUrl } from './git-utils'

function capabilitiesFromScopes(scopes?: string[]): string[] {
  if (!scopes || scopes.length === 0) return ['api:read']
  const caps: string[] = []
  const s = new Set(scopes.map(x => x.toLowerCase()))
  if (s.has('repo') || s.has('public_repo')) caps.push('repo:read', 'repo:write')
  if (s.has('workflow')) caps.push('actions:write')
  if (s.has('admin:org')) caps.push('org:admin')
  if (s.has('delete_repo')) caps.push('repo:delete')
  if (s.has('gist')) caps.push('gist:write')
  if (caps.length === 0) caps.push('api:read')
  return caps
}

export function resolveEffectiveGitHubAccount(
  request: ResolveEffectiveAccountRequest,
  configOverride?: GitHubConfig
): ResolveEffectiveAccountResult {
  const config = configOverride ?? loadGitHubConfig()
  const warnings: string[] = []

  const workspacePath = request.workspacePath?.trim()
  if (!workspacePath) {
    return {
      accountId: null,
      githubHost: null,
      authMethod: null,
      projectRoot: null,
      repository: null,
      owner: null,
      source: 'interactive-required',
      warnings: ['Kein Workspace-Pfad angegeben.'],
      capabilities: []
    }
  }

  // Determine git root (canonical)
  const gitRoot = request.repositoryPath
    ? normalizeProjectRoot(request.repositoryPath)
    : resolveGitRoot(workspacePath)
  const effectiveRoot = gitRoot ?? normalizeProjectRoot(workspacePath)

  // Also try to read remote for repository info
  let remoteUrl: string | null = null
  let parsedRemote = null as ReturnType<typeof parseGitRemoteUrl>
  if (gitRoot) {
    remoteUrl = getGitRemoteUrl(gitRoot)
    if (remoteUrl) parsedRemote = parseGitRemoteUrl(remoteUrl)
  }
  const owner = parsedRemote?.owner ?? null
  const repository = parsedRemote ? `${parsedRemote.owner}/${parsedRemote.repo}` : null

  // 1. session override
  if (request.sessionOverride) {
    const acc = config.accounts.find(a => a.id === request.sessionOverride && a.enabled)
    if (acc) {
      if (parsedRemote && acc.host.toLowerCase() !== parsedRemote.host.toLowerCase()) {
        warnings.push(`Konto-Host (${acc.host}) unterscheidet sich von Remote-Host (${parsedRemote.host}).`)
      }
      return {
        accountId: acc.id,
        githubHost: acc.host,
        authMethod: acc.authMethod,
        projectRoot: effectiveRoot,
        repository,
        owner,
        source: 'session-override',
        warnings,
        capabilities: capabilitiesFromScopes(acc.scopes)
      }
    }
    warnings.push('Temporär ausgewähltes Konto nicht gefunden oder deaktiviert.')
  }

  // 2. project binding (longest matching root)
  let bestBinding: typeof config.projectBindings[number] | null = null
  let bestLen = -1
  for (const binding of config.projectBindings) {
    const normalizedRoot = normalizeProjectRoot(binding.projectRoot)
    const candidatePath = gitRoot ?? normalizeProjectRoot(workspacePath)
    if (isSubPath(candidatePath, normalizedRoot)) {
      if (normalizedRoot.length > bestLen) {
        bestLen = normalizedRoot.length
        bestBinding = binding
      }
    }
  }
  if (bestBinding) {
    const acc = config.accounts.find(a => a.id === bestBinding!.accountId && a.enabled)
    if (acc) {
      if (parsedRemote && acc.host.toLowerCase() !== parsedRemote.host.toLowerCase()) {
        warnings.push(`Projektkonto-Host (${acc.host}) unterscheidet sich von Remote-Host (${parsedRemote.host}).`)
      }
      return {
        accountId: acc.id,
        githubHost: bestBinding.hostOverride ?? acc.host,
        authMethod: acc.authMethod,
        projectRoot: normalizeProjectRoot(bestBinding.projectRoot),
        repository,
        owner: bestBinding.preferredOwner ?? owner,
        source: 'project-binding',
        warnings,
        capabilities: capabilitiesFromScopes(acc.scopes)
      }
    }
    warnings.push('Projektbindung verweist auf fehlendes oder deaktiviertes Konto.')
  }

  // 3. remote-match: find account whose host matches remote host (and optionally owner login)
  if (parsedRemote) {
    // Prefer exact host+login match if multiple accounts share host
    const hostMatches = config.accounts.filter(a => a.enabled && a.host.toLowerCase() === parsedRemote!.host.toLowerCase())
    if (hostMatches.length === 1) {
      const acc = hostMatches[0]!
      return {
        accountId: acc.id,
        githubHost: acc.host,
        authMethod: acc.authMethod,
        projectRoot: effectiveRoot,
        repository,
        owner,
        source: 'remote-match',
        warnings,
        capabilities: capabilitiesFromScopes(acc.scopes)
      }
    }
    if (hostMatches.length > 1) {
      // Try owner == login heuristic
      const ownerMatch = hostMatches.find(a => a.login.toLowerCase() === parsedRemote!.owner.toLowerCase())
      if (ownerMatch) {
        return {
          accountId: ownerMatch.id,
          githubHost: ownerMatch.host,
          authMethod: ownerMatch.authMethod,
          projectRoot: effectiveRoot,
          repository,
          owner,
          source: 'remote-match',
          warnings: [...warnings, 'Mehrere Konten für diesen Host gefunden – Owner-Abgleich verwendet.'],
          capabilities: capabilitiesFromScopes(ownerMatch.scopes)
        }
      }
      warnings.push('Mehrere Konten für diesen Host gefunden – kein eindeutiger Remote-Abgleich möglich.')
    }
  }

  // 4. global default
  if (config.defaultAccountId) {
    const acc = config.accounts.find(a => a.id === config.defaultAccountId && a.enabled)
    if (acc) {
      if (parsedRemote && acc.host.toLowerCase() !== parsedRemote.host.toLowerCase()) {
        warnings.push(`Standardkonto-Host (${acc.host}) unterscheidet sich von Remote-Host (${parsedRemote.host}).`)
      }
      return {
        accountId: acc.id,
        githubHost: acc.host,
        authMethod: acc.authMethod,
        projectRoot: effectiveRoot,
        repository,
        owner,
        source: 'global-default',
        warnings,
        capabilities: capabilitiesFromScopes(acc.scopes)
      }
    }
    warnings.push('Standardkonto nicht gefunden oder deaktiviert.')
  }

  // 5. interactive required
  return {
    accountId: null,
    githubHost: parsedRemote?.host ?? null,
    authMethod: null,
    projectRoot: effectiveRoot,
    repository,
    owner,
    source: 'interactive-required',
    warnings: [...warnings, 'Kein Konto konfiguriert. Bitte ein GitHub-Konto hinzufügen.'],
    capabilities: []
  }
}
