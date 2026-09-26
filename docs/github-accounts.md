# GitHub-Konten in DSH Desktop

DSH Desktop verwaltet mehrere GitHub-Konten parallel und wählt automatisch das richtige Konto für jede Git- und GitHub-Aktion.

## Einrichtung

1. **Konto hinzufügen**: GitHub-Tab → Konten → Konto hinzufügen. Erforderlich: Label, GitHub-Login, Host (`github.com` oder GHES-Host), Auth-Methode.
2. **PAT (empfohlen)**: Fine-grained oder classic Token mit Scopes `repo`, `workflow` (für Actions), `delete_repo` (falls Repo-Löschung), `gist` (falls Gists). Token wird mit `safeStorage` (OS-Keychain/Credential Manager) verschlüsselt gespeichert, nie im Klartext in `github-accounts.json`.
3. **SSH**: Pfad zu privatem Schlüssel angeben, dann `SSH konfigurieren`. DSH schreibt nur einen verwalteten Block in `~/.ssh/config`:
   ```
   # DSH Desktop managed - github-account-<id> BEGIN
   Host github-<label>-<shortId>
       HostName github.com
       User git
       IdentityFile C:/Users/USER/.ssh/id_ed25519_...
       IdentitiesOnly yes
   # DSH Desktop managed - github-account-<id> END
   ```
   Remote-URL dann: `git@github-<label>-<shortId>:owner/repo.git`. Bestehende Einträge bleiben erhalten, vor Änderung Backup `~/.ssh/config.bak.<ts>`.
4. **GH CLI**: Wenn `gh` installiert und `gh auth login` ausgeführt ist, Auth-Methode `gh-cli` wählen. Token-Import optional.
5. **GHES**: Host z. B. `github.example.com`, Base-URL intern `https://<host>/api/v3`, sonst `https://api.github.com`.
6. **OAuth Device Flow / GitHub App**: Nur dokumentiert, PAT bevorzugt — erfordert eigene GitHub-App-Registrierung.

## Globales Standardkonto

Konten → `Als Standard` setzt `defaultAccountId`. Es wird verwendet, wenn kein Projektkonto und kein Remote-Match existiert.

## Projektbezogene Konten

Projekte → `Projekt zuordnen`: Projektpfad (kanonischer Git-Root, `realpath` + Windows-Normierung: Laufwerk klein, `\→/`, trailing slash entfernt) → Konto → Remote-Policy `auto|https|ssh` (optional `hostOverride`, `preferredOwner`, `defaultBranch`). Unterordner erben automatisch das Konto des Git-Roots (`C:\Projects\Kiro2DSH\src` → `C:\Projects\Kiro2DSH`). Directory-Picker verfügbar. Entfernen setzt auf globalen Standard zurück.

## Kontoauflösungsreihenfolge

Zentrale Funktion `resolveEffectiveGitHubAccount({ workspacePath, repositoryPath, operation, sessionOverride })`:

1. `sessionOverride` — temporär manuell gewählt (Session-Scope)
2. `projectBinding` — explizite Zuordnung, längster kanonischer Git-Root gewinnt
3. `remote-match` — Remote-URL Host/Owner gegen Konten (bei mehreren Konten auf gleichem Host Owner-Abgleich)
4. `global-default`
5. `interactive-required` — Fehler `GITHUB_ACCOUNT_NOT_FOUND`, kein stiller Fallback

Rückgabe: `accountId, githubHost, authMethod, projectRoot, repository, owner, source, warnings, capabilities` (Capabilities aus Scopes).

## GitHub Actions, Agent-Nutzung, Sicherheit

- Alle Git-Operationen (`status, clone, fetch, pull, push, branch, checkout/switch, merge, rebase, tag, remote, log, diff, stash, init`) und GitHub-API-Aufrufe (`/user`, Repos, Issues, PRs, Releases, Actions) lösen vor Ausführung den Resolver auf.
- Destruktive Aktionen (`push --force`, Branch/Tag-Löschung, Remote-Änderung, Repo-Löschung, Release-Erstellung, Workflow start/cancel, Branch-Protection/Webhook/Secret-Änderung) verlangen `confirmDestructive` und zeigen aktive Identität, Remote und Branch an; IPC liefert `GITHUB_DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION`.
- Agent: Vor jeder Git/GitHub-Aktion `github:agentContext` aufrufen. In Trajectory nur nicht-sensitives anzeigen:
  ```
  GitHub-Konto: Arbeit
  GitHub-Benutzer: work-user
  GitHub-Host: github.com
  Projektquelle: Projektzuordnung
  Authentifizierung: SSH
  Repository: organization/example-repository
  ```
  Nie: Tokens, Passphrasen, Private Keys, `Authorization`-Header. Bei `requiresConfirmation=true` strukturierte Bestätigung verlangen.

## Sicherheitsmodell

- Kein Klartext-Token in `github-accounts.json` (nur `credentialRef`), Logs, Trajectory, Remotes (`https://TOKEN@…` verboten), Env (nur temporär `GITHUB_TOKEN/GH_TOKEN` oder `GIT_SSH_COMMAND`), Screenshots, Diagnose.
- Redaction `redactGitHubSecrets` für `gh[oprs]_…`, `github_pat_…`, `Bearer …`.
- IPC: `assertTrusted` (nur `file://`, `dsh-desktop://`, `http://127.0.0.1`, main frame), strikte Validierung (`unknown → geprüft`), Pfad-Normalisierung + Traversal-Abwehr, Shell-Args als Array.
- HTTPS: bevorzugt Git Credential Manager / OS-Store / temporäres `GIT_ASKPASS`, kontoabhängiger Context, zwei Konten auf gleichem Host teilen kein globales Credential.
- SSH: nur verwaltete Blöcke geändert, Sicherung, Diff-Vorschau (`preview: true`), Undo möglich.

## Datenablage, Migration, Troubleshooting

- `app.getPath('userData')/github/github-accounts.json` (Dev: `dsh-desktop-dev`) — Metadaten, `version: 1`.
- `github/github-credentials.enc.json` — Werte `enc:<base64(safeStorage.encryptString(token))>` oder `b64:<base64>` Fallback, `0o600`, atomar `tmp+rename`.
- Migration: `version`-Feld, Backup `accounts.json.bak.<ts>` bei Korruption/Version-Mismatch.
- Fehlercodes: `GITHUB_ACCOUNT_NOT_FOUND`, `GITHUB_ACCOUNT_DISABLED`, `GITHUB_AUTH_REQUIRED`, `GITHUB_AUTH_EXPIRED`, `GITHUB_PERMISSION_DENIED`, `GITHUB_HOST_UNREACHABLE`, `GITHUB_REPOSITORY_NOT_FOUND`, `GITHUB_REMOTE_ACCOUNT_MISMATCH`, `GITHUB_SSH_KEY_NOT_FOUND`, `GITHUB_SSH_AUTH_FAILED`, `GITHUB_CREDENTIAL_STORE_UNAVAILABLE`, `GITHUB_OPERATION_CANCELLED`, `GITHUB_DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION`.
- Status: `github:getStatus` liefert `resolved`, `hasCredential`, `credentialStoreAvailable`, `configPath`, `ghCli`, `ssh`.
- SSH-IPC: `github:configureSsh` (mit `preview`), `github:removeSshConfig`, `github:getSshBlocks`.
- Typen & Resolver getestet gegen Windows-Pfadregeln, Remote-Parsing, Konflikt-Warnungen.

## Beispiel

```
Globales Konto: Privat
Projekt: C:\Projects\Kiro2DSH
Projektkonto: Arbeit
Ergebnis: Alle Git- und GitHub-Aktionen im Projekt Kiro2DSH verwenden automatisch das Konto Arbeit. Andere Projekte verwenden weiterhin Privat.
```

## Bekannte Einschränkungen

- OAuth Device Flow / GitHub App Token initial nur Stub/Doku, PAT empfohlen.
- Gists nur via generischem `github:apiRequest`.
- Workflow-Logs nur soweit API `GET /repos/{owner}/{repo}/actions/runs/{id}/logs` (Zip, `actions:read`) erlaubt.
- Ohne GCM auf Systemen Fallback auf temporäre `GIT_ASKPASS`-Helper.
