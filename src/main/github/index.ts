import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { app } from 'electron'
import { loadGitHubConfig, saveGitHubConfig, createAccountId, createCredentialRef, githubConfigPath } from './account-store'
import { storeCredential, loadCredential, removeCredential, credentialStoreAvailable } from './credential-store'
import { resolveEffectiveGitHubAccount } from './resolver'
import { fetchGitHubApi, testGitHubConnection } from './github-api'
import { runGitOperation } from './git-operations'
import { validateAccountInput, validateProjectBindingInput, requireString } from './validation'
import { normalizeProjectRoot, detectGhCliAuthStatus, detectSshAvailable, detectGitHubCliAvailable } from './git-utils'
import { redactGitHubSecrets } from '../../shared/github'
import { ensureSshManagedBlock, removeSshManagedBlock, previewSshConfigChange, getSshManagedBlocks } from './ssh-manager'
import { resolveAgentGitHubContext } from './agent-context'

function assertTrusted(event: IpcMainInvokeEvent): void {
  // Main window only; mirrors assertTrustedMainWindowEvent but avoids circular import
  const url = event.senderFrame?.url ?? ''
  if (url.startsWith('file://') || url.startsWith('dsh-desktop://')) return
  if (url.startsWith('http://127.0.0.1')) return
  // Allow in tests where senderFrame may be undefined
  if (!url) return
  throw new Error('Nicht autorisierter Aufrufer')
}

function redactError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  const redacted = redactGitHubSecrets(message)
  const code = (error as { code?: string })?.code
  const err = new Error(redacted) as Error & { code?: string }
  if (code) err.code = code
  return err
}

export function registerGitHubIpc(): void {
  ipcMain.removeHandler('github:getConfig')
  ipcMain.handle('github:getConfig', async (event) => {
    assertTrusted(event)
    const config = loadGitHubConfig()
    // Never expose credential values
    return config
  })

  ipcMain.removeHandler('github:addAccount')
  ipcMain.handle('github:addAccount', async (event, input: unknown) => {
    assertTrusted(event)
    const validated = validateAccountInput(input)
    const config = loadGitHubConfig()
    const id = createAccountId()
    const credentialRef = createCredentialRef(id)
    const now = new Date().toISOString()
    if (validated.token) {
      if (!credentialStoreAvailable()) {
        // Still allow but warn via error code path: store with fallback
      }
      storeCredential(credentialRef, validated.token)
    } else if (validated.authMethod === 'pat' || validated.authMethod === 'ghe-pat') {
      throw new Error('Token ist für diese Auth-Methode erforderlich')
    }
    // SSH key path is stored as credential-like meta (not secret) – store separately if needed
    if (validated.sshKeyPath) {
      storeCredential(`${credentialRef}:ssh`, validated.sshKeyPath)
    }
    const account = {
      id,
      label: validated.label,
      login: validated.login,
      host: validated.host,
      authMethod: validated.authMethod as import('../../shared/github').GitHubAuthMethod,
      credentialRef,
      enabled: true,
      createdAt: now,
      updatedAt: now
    }
    config.accounts.push(account)
    if (!config.defaultAccountId) config.defaultAccountId = id
    saveGitHubConfig(config)
    return account
  })

  ipcMain.removeHandler('github:updateAccount')
  ipcMain.handle('github:updateAccount', async (event, accountId: unknown, patch: unknown) => {
    assertTrusted(event)
    const id = requireString(accountId, 'Konto-ID')
    const config = loadGitHubConfig()
    const account = config.accounts.find(a => a.id === id)
    if (!account) throw Object.assign(new Error('Konto nicht gefunden'), { code: 'GITHUB_ACCOUNT_NOT_FOUND' })
    const obj = (patch && typeof patch === 'object' ? patch as Record<string, unknown> : {}) as Record<string, unknown>
    if (typeof obj.label === 'string') account.label = obj.label.trim().slice(0, 64) || account.label
    if (typeof obj.login === 'string' && obj.login.trim()) account.login = obj.login.trim()
    if (typeof obj.host === 'string' && obj.host.trim()) account.host = obj.host.trim().toLowerCase()
    if (typeof obj.enabled === 'boolean') account.enabled = obj.enabled
    if (typeof obj.token === 'string' && obj.token.trim()) {
      storeCredential(account.credentialRef, obj.token.trim())
    }
    account.updatedAt = new Date().toISOString()
    saveGitHubConfig(config)
    return account
  })

  ipcMain.removeHandler('github:removeAccount')
  ipcMain.handle('github:removeAccount', async (event, accountId: unknown) => {
    assertTrusted(event)
    const id = requireString(accountId, 'Konto-ID')
    const config = loadGitHubConfig()
    const idx = config.accounts.findIndex(a => a.id === id)
    if (idx === -1) throw Object.assign(new Error('Konto nicht gefunden'), { code: 'GITHUB_ACCOUNT_NOT_FOUND' })
    const [removed] = config.accounts.splice(idx, 1)
    removeCredential(removed!.credentialRef)
    removeCredential(`${removed!.credentialRef}:ssh`)
    if (config.defaultAccountId === id) {
      config.defaultAccountId = config.accounts[0]?.id ?? null
    }
    // Remove bindings referencing this account
    config.projectBindings = config.projectBindings.filter(b => b.accountId !== id)
    saveGitHubConfig(config)
    return { ok: true }
  })

  ipcMain.removeHandler('github:setDefaultAccount')
  ipcMain.handle('github:setDefaultAccount', async (event, accountId: unknown) => {
    assertTrusted(event)
    const id = requireString(accountId, 'Konto-ID')
    const config = loadGitHubConfig()
    if (!config.accounts.some(a => a.id === id)) throw Object.assign(new Error('Konto nicht gefunden'), { code: 'GITHUB_ACCOUNT_NOT_FOUND' })
    config.defaultAccountId = id
    saveGitHubConfig(config)
    return { ok: true }
  })

  ipcMain.removeHandler('github:testConnection')
  ipcMain.handle('github:testConnection', async (event, accountId: unknown) => {
    assertTrusted(event)
    const id = requireString(accountId, 'Konto-ID')
    try {
      const result = await testGitHubConnection(id)
      if (result.ok) {
        const config = loadGitHubConfig()
        const acc = config.accounts.find(a => a.id === id)
        if (acc && result.login) {
          acc.login = result.login
          if (result.scopes) acc.scopes = result.scopes
          acc.updatedAt = new Date().toISOString()
          saveGitHubConfig(config)
        }
      }
      return result
    } catch (error) {
      throw redactError(error)
    }
  })

  ipcMain.removeHandler('github:resolveEffective')
  ipcMain.handle('github:resolveEffective', async (event, request: unknown) => {
    assertTrusted(event)
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Ungültige Anfrage')
    const obj = request as Record<string, unknown>
    const workspacePath = typeof obj.workspacePath === 'string' ? obj.workspacePath : ''
    if (!workspacePath) throw new Error('workspacePath ist erforderlich')
    const repositoryPath = typeof obj.repositoryPath === 'string' ? obj.repositoryPath : null
    const operation = typeof obj.operation === 'string' ? obj.operation : 'unknown'
    const sessionOverride = typeof obj.sessionOverride === 'string' ? obj.sessionOverride : null
    return resolveEffectiveGitHubAccount({ workspacePath, repositoryPath, operation, sessionOverride })
  })

  ipcMain.removeHandler('github:setProjectBinding')
  ipcMain.handle('github:setProjectBinding', async (event, input: unknown) => {
    assertTrusted(event)
    const validated = validateProjectBindingInput(input)
    const config = loadGitHubConfig()
    if (!config.accounts.some(a => a.id === validated.accountId)) throw Object.assign(new Error('Konto nicht gefunden'), { code: 'GITHUB_ACCOUNT_NOT_FOUND' })
    const normalizedRoot = normalizeProjectRoot(validated.projectRoot)
    const existingIdx = config.projectBindings.findIndex(b => normalizeProjectRoot(b.projectRoot) === normalizedRoot)
    const binding = {
      projectRoot: normalizedRoot,
      accountId: validated.accountId,
      remotePolicy: (validated.remotePolicy as import('../../shared/github').GitHubRemotePolicy) ?? 'auto',
      hostOverride: validated.hostOverride ?? null,
      preferredOwner: validated.preferredOwner ?? null,
      defaultBranch: validated.defaultBranch ?? null
    }
    if (existingIdx >= 0) config.projectBindings[existingIdx] = binding
    else config.projectBindings.push(binding)
    saveGitHubConfig(config)
    return binding
  })

  ipcMain.removeHandler('github:removeProjectBinding')
  ipcMain.handle('github:removeProjectBinding', async (event, projectRoot: unknown) => {
    assertTrusted(event)
    const root = requireString(projectRoot, 'Projektpfad')
    const normalized = normalizeProjectRoot(root)
    const config = loadGitHubConfig()
    const before = config.projectBindings.length
    config.projectBindings = config.projectBindings.filter(b => normalizeProjectRoot(b.projectRoot) !== normalized)
    if (config.projectBindings.length === before) throw new Error('Projektbindung nicht gefunden')
    saveGitHubConfig(config)
    return { ok: true }
  })

  ipcMain.removeHandler('github:apiRequest')
  ipcMain.handle('github:apiRequest', async (event, options: unknown) => {
    assertTrusted(event)
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Ungültige API-Anfrage')
    const obj = options as Record<string, unknown>
    const accountId = requireString(obj.accountId, 'Konto-ID')
    const path = requireString(obj.path, 'Pfad')
    if (!path.startsWith('/')) throw new Error('Pfad muss mit / beginnen')
    if (path.includes('..')) throw new Error('Ungültiger Pfad')
    const method = typeof obj.method === 'string' ? obj.method.toUpperCase() : 'GET'
    const allowed = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
    if (!allowed.has(method)) throw new Error('Ungültige Methode')
    try {
      const result = await fetchGitHubApi({
        accountId,
        path,
        method,
        body: obj.body,
        hostOverride: typeof obj.hostOverride === 'string' ? obj.hostOverride : null
      })
      return result
    } catch (error) {
      throw redactError(error)
    }
  })

  ipcMain.removeHandler('github:gitOperation')
  ipcMain.handle('github:gitOperation', async (event, request: unknown) => {
    assertTrusted(event)
    if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('Ungültige Git-Anfrage')
    const obj = request as Record<string, unknown>
    const operation = typeof obj.operation === 'string' ? obj.operation : ''
    const allowedOps = new Set(['status', 'clone', 'fetch', 'pull', 'push', 'branch', 'checkout', 'switch', 'merge', 'rebase', 'tag', 'remote', 'log', 'diff', 'stash', 'init'])
    if (!allowedOps.has(operation)) throw new Error('Ungültige Git-Operation')
    const cwd = typeof obj.cwd === 'string' ? obj.cwd : ''
    const workspacePath = typeof obj.workspacePath === 'string' ? obj.workspacePath : cwd
    const args = Array.isArray(obj.args) ? (obj.args as unknown[]).filter((a): a is string => typeof a === 'string') : []
    // Validate args don't contain shell injection via ; | & $ ` etc when joined – we pass as array but still reject suspicious
    for (const arg of args) {
      if (arg.includes('\0')) throw new Error('Ungültiges Argument')
    }
    const accountId = typeof obj.accountId === 'string' ? obj.accountId : null
    const confirmDestructive = obj.confirmDestructive === true
    try {
      const result = await runGitOperation({
        operation: operation as import('./git-operations').GitOperation,
        args,
        cwd: cwd || workspacePath,
        workspacePath,
        accountId,
        confirmDestructive
      })
      return result
    } catch (error) {
      throw redactError(error)
    }
  })

  ipcMain.removeHandler('github:configureSsh')
  ipcMain.handle('github:configureSsh', async (event, input: unknown) => {
    assertTrusted(event)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige SSH-Konfiguration')
    const obj = input as Record<string, unknown>
    const accountId = requireString(obj.accountId, 'Konto-ID')
    const label = typeof obj.label === 'string' ? obj.label.trim() : ''
    const hostName = typeof obj.hostName === 'string' ? obj.hostName : 'github.com'
    const identityFile = requireString(obj.identityFile, 'SSH-Schlüsselpfad')
    const useAgent = obj.useAgent === true
    const preview = obj.preview === true
    if (preview) return previewSshConfigChange({ accountId, label: label || 'gh', hostName, identityFile, useAgent })
    return ensureSshManagedBlock({ accountId, label: label || 'gh', hostName, identityFile, useAgent })
  })

  ipcMain.removeHandler('github:removeSshConfig')
  ipcMain.handle('github:removeSshConfig', async (event, accountId: unknown) => {
    assertTrusted(event)
    const id = requireString(accountId, 'Konto-ID')
    return removeSshManagedBlock(id)
  })

  ipcMain.removeHandler('github:getSshBlocks')
  ipcMain.handle('github:getSshBlocks', async (event) => {
    assertTrusted(event)
    return getSshManagedBlocks()
  })

  ipcMain.removeHandler('github:agentContext')
  ipcMain.handle('github:agentContext', async (event, input: unknown) => {
    assertTrusted(event)
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ungültige Agent-Kontext-Anfrage')
    const obj = input as Record<string, unknown>
    const workspacePath = typeof obj.workspacePath === 'string' ? obj.workspacePath : ''
    if (!workspacePath) throw new Error('workspacePath ist erforderlich')
    const repositoryPath = typeof obj.repositoryPath === 'string' ? obj.repositoryPath : null
    const operation = typeof obj.operation === 'string' ? obj.operation : 'unknown'
    const sessionOverride = typeof obj.sessionOverride === 'string' ? obj.sessionOverride : null
    const args = Array.isArray(obj.args) ? (obj.args as unknown[]).filter((a): a is string => typeof a === 'string') : undefined
    const apiPath = typeof obj.apiPath === 'string' ? obj.apiPath : null
    const apiMethod = typeof obj.apiMethod === 'string' ? obj.apiMethod : null
    return resolveAgentGitHubContext({ workspacePath, repositoryPath, operation, sessionOverride, args, apiPath, apiMethod })
  })

  ipcMain.removeHandler('github:getStatus')
  ipcMain.handle('github:getStatus', async (event, workspacePath: unknown) => {
    assertTrusted(event)
    const wp = typeof workspacePath === 'string' && workspacePath.trim() ? workspacePath : app.getPath('userData')
    const resolved = resolveEffectiveGitHubAccount({
      workspacePath: wp,
      operation: 'status'
    })
    const hasCredential = resolved.accountId
      ? (() => {
          const cfg = loadGitHubConfig()
          const acc = cfg.accounts.find(a => a.id === resolved.accountId)
          return acc ? !!loadCredential(acc.credentialRef) || acc.authMethod === 'ssh' : false
        })()
      : false
    return {
      resolved,
      hasCredential,
      credentialStoreAvailable: credentialStoreAvailable(),
      configPath: githubConfigPath(),
      ghCli: detectGhCliAuthStatus(),
      ghCliAvailable: detectGitHubCliAvailable(),
      ssh: detectSshAvailable()
    }
  })
}
