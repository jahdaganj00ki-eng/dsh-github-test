import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { buildSshAlias } from './git-utils'

const MANAGED_PREFIX = '# DSH Desktop managed - github-account-'

function sshConfigPath(): string {
  return join(homedir(), '.ssh', 'config')
}

function managedBegin(accountId: string): string {
  return `${MANAGED_PREFIX}${accountId} BEGIN`
}

function managedEnd(accountId: string): string {
  return `${MANAGED_PREFIX}${accountId} END`
}

function backupSshConfig(): string | null {
  const configPath = sshConfigPath()
  if (!existsSync(configPath)) return null
  const backupPath = `${configPath}.bak.${Date.now()}`
  try {
    copyFileSync(configPath, backupPath)
    return backupPath
  } catch {
    return null
  }
}

function readSshConfig(): string {
  const configPath = sshConfigPath()
  if (!existsSync(configPath)) return ''
  try {
    return readFileSync(configPath, 'utf8')
  } catch {
    return ''
  }
}

function atomicWriteSshConfig(content: string): void {
  const configPath = sshConfigPath()
  mkdirSync(dirname(configPath), { recursive: true })
  const tmp = `${configPath}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, content, { mode: 0o600 })
    renameSync(tmp, configPath)
  } finally {
    if (existsSync(tmp)) {
      try { unlinkSync(tmp) } catch {}
    }
  }
}

function removeManagedBlock(content: string, accountId: string): string {
  const begin = managedBegin(accountId)
  const end = managedEnd(accountId)
  const lines = content.split(/\r?\n/)
  const result: string[] = []
  let skipping = false
  for (const line of lines) {
    if (line.trim() === begin) {
      skipping = true
      continue
    }
    if (line.trim() === end) {
      skipping = false
      continue
    }
    if (!skipping) result.push(line)
  }
  // Trim trailing empty lines but keep final newline
  while (result.length > 0 && result[result.length - 1]!.trim() === '') result.pop()
  return result.join('\n') + (result.length > 0 ? '\n' : '')
}

function buildManagedBlock(accountId: string, label: string, hostName: string, identityFile: string, useAgent: boolean): string {
  const alias = buildSshAlias(accountId, label)
  const lines = [
    managedBegin(accountId),
    `Host ${alias}`,
    `    HostName ${hostName}`,
    '    User git',
    `    IdentityFile ${identityFile}`,
    '    IdentitiesOnly yes'
  ]
  if (!useAgent) {
    lines.push('    AddKeysToAgent no')
  }
  lines.push(managedEnd(accountId))
  return lines.join('\n')
}

export interface SshConfigOptions {
  accountId: string
  label: string
  hostName: string
  identityFile: string
  useAgent?: boolean
}

export interface SshConfigResult {
  alias: string
  backupPath: string | null
  previousContent: string
  newContent: string
}

export function ensureSshManagedBlock(options: SshConfigOptions): SshConfigResult {
  const identityFile = options.identityFile.trim()
  if (!identityFile) throw new Error('SSH IdentityFile ist erforderlich')
  if (identityFile.includes('\0') || identityFile.includes('\n')) throw new Error('Ungültiger SSH-Schlüsselpfad')
  if (!existsSync(identityFile)) throw Object.assign(new Error(`SSH-Schlüssel nicht gefunden: ${identityFile}`), { code: 'GITHUB_SSH_KEY_NOT_FOUND' })

  const hostName = options.hostName.trim().toLowerCase() || 'github.com'
  const alias = buildSshAlias(options.accountId, options.label)
  const previousContent = readSshConfig()
  const withoutOld = removeManagedBlock(previousContent, options.accountId)
  const block = buildManagedBlock(options.accountId, options.label, hostName, identityFile, options.useAgent ?? false)
  const newContent = withoutOld + (withoutOld.endsWith('\n') || withoutOld === '' ? '' : '\n') + block + '\n'
  const backupPath = backupSshConfig()
  atomicWriteSshConfig(newContent)
  return { alias, backupPath, previousContent, newContent }
}

export function removeSshManagedBlock(accountId: string): { backupPath: string | null; removed: boolean } {
  const previousContent = readSshConfig()
  const newContent = removeManagedBlock(previousContent, accountId)
  if (newContent === previousContent) return { backupPath: null, removed: false }
  const backupPath = backupSshConfig()
  atomicWriteSshConfig(newContent)
  return { backupPath, removed: true }
}

export function getSshManagedBlocks(): Array<{ accountId: string; alias: string; hostName: string }> {
  const content = readSshConfig()
  const blocks: Array<{ accountId: string; alias: string; hostName: string }> = []
  const beginRegex = new RegExp(`${MANAGED_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+) BEGIN`, 'g')
  let match: RegExpExecArray | null
  while ((match = beginRegex.exec(content)) !== null) {
    const accountId = match[1]!.trim()
    const alias = buildSshAlias(accountId, 'tmp')
    // Try to extract HostName after BEGIN
    const blockStart = match.index
    const blockEnd = content.indexOf(managedEnd(accountId), blockStart)
    const block = blockEnd >= 0 ? content.slice(blockStart, blockEnd) : ''
    const hostMatch = /HostName\s+(\S+)/.exec(block)
    blocks.push({ accountId, alias, hostName: hostMatch ? hostMatch[1]! : 'github.com' })
  }
  return blocks
}

export function previewSshConfigChange(options: SshConfigOptions): { alias: string; diff: string } {
  const previousContent = readSshConfig()
  const withoutOld = removeManagedBlock(previousContent, options.accountId)
  const block = buildManagedBlock(options.accountId, options.label, options.hostName, options.identityFile, options.useAgent ?? false)
  const alias = buildSshAlias(options.accountId, options.label)
  const newContent = withoutOld + (withoutOld.endsWith('\n') || withoutOld === '' ? '' : '\n') + block + '\n'
  return { alias, diff: `--- a/.ssh/config\n+++ b/.ssh/config\n+${block.split('\n').join('\n+')}` }
}

export function testSshConnection(alias: string): { ok: boolean; message: string } {
  // Caller should use execFileSync('ssh', ['-T', `git@${alias}`]) externally;
  // This helper only validates alias format to avoid injection.
  if (!/^[a-zA-Z0-9._-]+$/.test(alias)) throw new Error('Ungültiger SSH-Alias')
  return { ok: true, message: `Teste SSH-Verbindung zu ${alias}` }
}
