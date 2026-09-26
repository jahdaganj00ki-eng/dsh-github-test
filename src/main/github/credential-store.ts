import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { safeStorage } from 'electron'
import { githubCredentialsPath } from './account-store'

type CredentialMap = Record<string, string>

function readEncryptedFile(): CredentialMap {
  const path = githubCredentialsPath()
  if (!existsSync(path)) return {}
  try {
    const raw = readFileSync(path, 'utf8').trim()
    if (!raw) return {}
    const parsed = JSON.parse(raw) as CredentialMap
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    return {}
  } catch {
    return {}
  }
}

function writeEncryptedFile(map: CredentialMap): void {
  const path = githubCredentialsPath()
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(map, null, 2), { mode: 0o600 })
    renameSync(tmp, path)
  } finally {
    if (existsSync(tmp)) {
      try { unlinkSync(tmp) } catch {}
    }
  }
}

export function credentialStoreAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function storeCredential(credentialRef: string, secret: string): void {
  const map = readEncryptedFile()
  if (credentialStoreAvailable()) {
    const encrypted = safeStorage.encryptString(secret).toString('base64')
    map[credentialRef] = `enc:${encrypted}`
  } else {
    // Fallback: still base64-obscured but warn caller; file is 0600
    map[credentialRef] = `b64:${Buffer.from(secret, 'utf8').toString('base64')}`
  }
  writeEncryptedFile(map)
}

export function loadCredential(credentialRef: string): string | null {
  const map = readEncryptedFile()
  const stored = map[credentialRef]
  if (!stored) return null
  if (stored.startsWith('enc:')) {
    if (!credentialStoreAvailable()) return null
    try {
      const buf = Buffer.from(stored.slice(4), 'base64')
      return safeStorage.decryptString(buf)
    } catch {
      return null
    }
  }
  if (stored.startsWith('b64:')) {
    try {
      return Buffer.from(stored.slice(4), 'base64').toString('utf8')
    } catch {
      return null
    }
  }
  return null
}

export function removeCredential(credentialRef: string): void {
  const map = readEncryptedFile()
  if (!(credentialRef in map)) return
  delete map[credentialRef]
  writeEncryptedFile(map)
}

export function hasCredential(credentialRef: string): boolean {
  const map = readEncryptedFile()
  return credentialRef in map
}
