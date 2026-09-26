# Multi-GitHub-Account Implementierungsplan (DSH Desktop)

Stand: 2026-09-26 · Harness 0.1.7-rc.2 · Ziel: vertikale Scheibe + Erweiterungsfähigkeit

## 1. Analyse-Erkenntnisse

- **Workspace-Speicherung**: Harness hält Workspaces in `storages/workspace.json` (via `dsh-workspace`), Settings in `settings.yaml`, Credentials in `.credentials.yaml`, Sessions/Profiles unter `Electron userData/harness/`. Workspaces werden in Harness über `ctx.workspaceRegistry` geführt, Desktop spiegelt sie nicht separat.
- **Projektordner-Erkennung**: `cwd` der Session (`session.header.cwd`) ist die Quelle. Git-Root muss via `git rev-parse --show-toplevel` aufgelöst werden, normalisiert über `realpath` + Windows-Kleinbuchstaben-Laufwerk + Slash-Normierung, um `C:\Projects\Kiro2DSH\…`-Unterordner korrekt dem Root zuzuordnen.
- **Prozess-Topologie**: `src/main` = Electron Main (privilegiert), `src/preload` = schmaler Bridge (`contextBridge`), `src/shared` = serialisierbare Kontrakte, `packages/*` = Host-Plugins (`window.__ModuleLoader__.load`, Cordis-Slots), `patches/*` = reproduzierbare `patch-package`-Patches. Renderer hat nie Node/Credential-Zugriff.
- **Harness-Slots**: Keine dedizierte „GitHub-Tab“-Slot neben Chat/Trajectory vorhanden. Verfügbare stabile Slots: `sidebar.footer.action`, `sidebar.settings`, `sidebar.workspaces.session.menu.item`, `conversation.hero.modeActions`, `sidebar.panel`. Daraus folgt: GitHub-Tab wird als Host-Plugin mit eigener Panel-Route + Preload-injizierter Tab-Leiste (Fallback bei fehlendem Slot) umgesetzt.
- **Bestehende APIs**: Credential-Store = Harness `dsh-credentials` (für LLM-Provider), Desktop nutzt `safeStorage`-fähige `desktop-storage.json`. Kein bestehender GitHub/Git-Account-Service. Git/GitHub-Aufrufe laufen heute ausschließlich über Agent-Tools (`dsh-bash-local`, `dsh-pwsh-local`) ohne Account-Kontext.
- **Sicherheitsgrenzen**: Main validiert IPC (`isTrustedAppUrl`, Haupt-Frame), Preload exponiert nur benannte Methoden, keine generische `invoke(channel, …)`. Tokens dürfen nie in Logs/Trajectory/Remotes erscheinen. Pfade gegen Traversal prüfen, Shell via Argument-Array, nicht String-Konkatenation.

## 2. Umsetzungsform

**Kombination Plugin + Electron-Main-Erweiterung + kleiner Harness-Patch nur falls Tab-Slot fehlt**

- **Host-Plugin** `packages/dsh-desktop-github` (JS, `window.__ModuleLoader__`) – liefert GitHub-UI (Übersicht/Konten/Projekte), Registrierung über bestehende Slots + Locale/Primitives.
- **Desktop-native Erweiterung** `src/main/github/*` + `src/shared/github.ts` + `src/preload/github.ts` – Account-Store, Credential-Store (OS-Keychain via `safeStorage`), Resolver, Git/GitHub-Services, validierte IPC.
- **Kein zweiter Agent-Runtime**, kein eigener Backend-Stack; bestehende `dsh-workspace`/`dsh-session` + `subprocess`/`sandboxPolicy` werden wiederverwendet.
- **Patch** nur wenn ein neuer Tab-Container-Slot benötigt wird (`dsh-client-ui-conversation` minimal, analog PPT-Commerce). Primär wird versucht, ohne Patch auszukommen (Sidebar-Panel + Preload-Tab-Injection).

## 3. Betroffene Dateien (neu / zu ändern)

**Neu**
- `src/shared/github.ts` – Kontrakte, ErrorCodes, Resolver-Types
- `src/main/github/account-store.ts` – Versionierung, atomares Schreiben, Migration, Backup
- `src/main/github/credential-store.ts` – `safeStorage` encrypt/decrypt, Ref-Mapping
- `src/main/github/git-utils.ts` – Pfad-Normierung, Git-Root, Remote-Parsing, Host-Erkennung, SSH-Alias
- `src/main/github/resolver.ts` – `resolveEffectiveGitHubAccount(…)`
- `src/main/github/github-api.ts` – Octokit-light Fetch (Profil, Repos, Issues, PRs, Actions, Releases)
- `src/main/github/git-operations.ts` – `GitOperationService` (spawn git mit korrektem Credential-Kontext)
- `src/main/github/validation.ts` – IPC-Input-Validatoren
- `src/preload/github.ts` – schmale GitHub-Preload-Bridge
- `packages/dsh-desktop-github/{package.json,index.js,client.js}` – Host-Plugin
- `test/github-*.test.ts|mjs` – Unit/Integration/Security
- `docs/github-accounts.md` – Nutzer-Doku

**Ändern**
- `src/main/index.ts` – IPC-Handler registrieren, Lifecycle integrieren
- `src/preload/index.ts` – `github.ts` importieren
- `src/shared/contracts.ts` – Re-export der GitHub-Kontrakte
- `build/dsh-desktop.patch.yml` – Plugin-Insertion `dsh-desktop-github`
- `package.json` – Plugin-Dep `dsh-desktop-github`
- `electron.vite.config.ts` – Preload `github` entry (falls separates Bundle nötig)

## 4. Datenmodell (persistiert, nicht-sensitiv)

Pfad: `app.getPath('userData')/github/accounts.json` (Dev: `dsh-desktop-dev`). Credentials separat: `github/credentials.enc.json` (Werte = `safeStorage.encryptString(token)` Base64). Beide atomar geschrieben, 0600, Backup bei Migration.

```json
{
  "version": 1,
  "defaultAccountId": "01H…",
  "accounts": [
    {
      "id": "01H…",
      "label": "Privat",
      "login": "alice",
      "displayName": "Alice Example",
      "avatarUrl": "https://avatars.githubusercontent.com/u/…",
      "host": "github.com",
      "authMethod": "pat",
      "credentialRef": "cred_01H…",
      "enabled": true,
      "createdAt": "2026-09-26T…",
      "updatedAt": "2026-09-26T…",
      "scopes": ["repo","workflow"],
      "organizations": ["acme"]
    }
  ],
  "projectBindings": [
    {
      "projectRoot": "C:\\Projects\\Kiro2DSH",
      "accountId": "01H…",
      "remotePolicy": "auto",
      "hostOverride": null,
      "preferredOwner": "acme",
      "defaultBranch": "main"
    }
  ]
}
```

- `id` = `crypto.randomUUID()`, nie Anzeigename.
- `projectRoot` = kanonischer, `realpathSync`-normalisierter Git-Root (Windows: Laufwerk klein, Backslash→Slash, trim trailing `/`, Symlink aufgelöst).
- `authMethod` ∈ `pat|oauth|ssh|gh-cli|ghe-pat|app-token`.
- `credentialRef` zeigt auf verschlüsselten Eintrag; Config enthält nie Klartext-Token.
- `enabled=false` deaktiviert ohne Löschen.

Migration: `version` Feld, `migrate(old)` füllt Defaults, sichert `accounts.json.bak.<ts>`.

## 5. Sicherheitsmodell

- **Kein Klartext-Token** in `accounts.json`, Logs, Trajectory, Remotes, Env, Screenshots. Redaction via `desktop-service.redact` erweitert um `gh[op]_…`, `github_pat_…`.
- **OS Credential Store**: `safeStorage.isEncryptionAvailable()` → `encryptString/decryptString`; fallback nur wenn nicht verfügbar → Datei mit DPAPI/Keychain, niemals Klartext. Passphrase nur über OS-Speicher.
- **IPC-Härtung**: Jeder Handler prüft `event.senderFrame.url` ist trusted (`file:`/`dsh-desktop:`/`http://127.0.0.1`), `isMainFrame===true`, validiert `workspacePath` (isAbsolute, innerhalb erlaubter Roots, kein `..`, normalisiert), verwirft `credential` aus Renderer-Input (nur Main darf lesen).
- **Shell-Sicherheit**: `spawn('git', argsArray, { env: filtered })`, keine String-Interpolation. `remoteUrl` wird geparst, nicht evaluiert.
- **SSH**: Ändert nur gemanagten Block in `~/.ssh/config` (`# DSH Desktop managed - github-account-<id> BEGIN/END`), sichert vorher, zeigt Diff, ermöglicht Undo.
- **HTTPS**: Kein `https://TOKEN@github.com/…` Einbetten; nutzt `git credential` Helper + temporäre `GIT_ASKPASS` oder `GCM`, kontoabhängiger Context via `credential.<url>.helper` + `http.<url>.extraHeader` (temporär, nicht persistiert). Zwei Konten auf gleichem Host teilen kein globales Credential.
- **Fehler-Redaction**: Vor jedem `throw`/Log `redactSensitive(value)` (Token, `Authorization:`, private Keys).

## 6. Authentifizierungsstrategie

| Methode | Status | Details |
|---|---|---|
| **PAT (classic/fine-grained)** | Voll | Eingabe → `safeStorage` → `GET /user` Validierung, Scopes aus Header `x-oauth-scopes` / `GET /user` |
| **GitHub.com + GHES** | Voll | `host` frei wählbar, Base-URL `https://<host>/api/v3` für GHES, `https://api.github.com` für dotcom |
| **SSH-Key-Auswahl** | Voll | Pfad zu `id_*`, `ssh -T git@<alias>` Test, Alias-Generierung `github-<label>-<shortId>` |
| **GH-CLI Auth** | Teil | Erkennung `gh auth status`, Token-Import optional, kein automatisches `gh` Invizieren ohne User-Consent |
| **OAuth Device Flow** | Dokumentiert, Fallback PAT | Vollständiger Flow benötigt GitHub App-Registrierung; implementiert als generischer Device-Flow-Stub + Doku „PAT empfohlen“ |
| **GitHub App Token** | Optional Stub | Wenn ohne Komplexität möglich: Installation-Token via `POST /app/installations/…/access_tokens`, sonst klar als nicht unterstützt dokumentiert |

Verbindungstest pro Konto: `GET https://<host>/user` (PAT/OAuth) oder `ssh -T` (SSH) + `gh --version` Probe. UI zeigt `verbunden / Token abgelaufen / SSH nicht gefunden / Host unerreichbar`.

## 7. Resolver & Priorität (zentral, einzige Funktion)

```ts
resolveEffectiveGitHubAccount({
  workspacePath,       // aktueller Workspace-Ordner (aus Session)
  repositoryPath?,     // optional expliziter Repo-Pfad
  operation,           // z.B. "push"|"clone"|"api:listRepos"
  sessionOverride?     // temporär manuell gewählt (Session-Scope)
}): {
  accountId, githubHost, authMethod, projectRoot, repository, owner,
  source: 'session-override'|'project-binding'|'remote-match'|'global-default'|'interactive-required',
  warnings, capabilities
}
```

Reihenfolge: `1 sessionOverride` → `2 projectBinding` (kanonischer Git-Root, Unterordner erben) → `3 Remote-Match` (Remote-URL Host/Owner gegen Konten) → `4 globalDefault` → `5 Fehler GITHUB_ACCOUNT_NOT_FOUND` (nie stiller Fallback). Rückgabe enthält `warnings` (z.B. Remote-Host ≠ Konto-Host) und `capabilities` (abgeleitet aus Scopes).

Windows-Pfadregeln: `path.resolve → realpathSync (falls vorhanden) → replace('\\','/') → Laufwerk toLowerCase → trimTrailingSlash → case-insensitive Vergleich`.

## 8. Git-/GitHub-Operationen

**Zentraler Service-Namesraum** (`GitHubAccountManager`, `GitHubContextResolver`, `GitCredentialService`, `GitHubApiService`, `GitOperationService`, `GitHubActionService`) – an Konvention angepasst (`account-store`, `resolver`, etc.).

Alle Operationen rufen vor Ausführung den Resolver auf, zeigen `accountLabel/host/remote/branch` in UI/Trajectory, verlangen bei destruktiven Aktionen (`push --force`, Branch-Löschung, Remote-Ändern, Repo löschen, Release erstellen, Workflow starten/abbrechen) zusätzliche Bestätigung (`GITHUB_DESTRUCTIVE_ACTION_REQUIRES_CONFIRMATION`).

- **Git**: `status, init, clone, fetch, pull, push, branch, checkout/switch, merge, rebase, tag, remote, log, diff, stash` – via `spawn git` mit kontoabhängiger Env (`GIT_SSH_COMMAND="ssh -F <managed-config> -i <key>"` oder `GCM`-Helper).
- **GitHub API**: `GET /user`, `GET /user/repos`, `POST /user/repos`, `PATCH /repos/{owner}/{repo}`, `GET /repos/{owner}/{repo}/issues`, `POST /repos/{owner}/{repo}/issues`, PR/Actions/Releases analog, je nach Token-Scope mit verständlicher `GITHUB_PERMISSION_DENIED`-Erklärung.
- **Secrets/Variablen**: Nie auslesen/anzeigen (nur Existenz + Set-Hinweis).

## 9. UI-Struktur (deutschsprachig, an Harness angelehnt)

**Ort**: Host-Plugin `dsh-desktop-github` registriert über `slots`; primär `sidebar.panel` / `sidebar.footer.action` + `conversation.hero.modeActions`. Zusätzlich Preload-Tab-Injektion neben Chat/Trajectory wenn kein passender Tab-Slot existiert (durch `data-dsh-github-tab` Marker, idempotent, `ResizeObserver` + `requestAnimationFrame`).

**Seiten**

1. **Übersicht** – aktives Konto + Quelle (Badge: projektspezifisch/global/manuell), Projektordner, Remote-URL, Host, Auth-Status (Ampel), Verbindungstest, Auth-Methode, GH-CLI/SSH-Status; Buttons: Konto wechseln, Verbindung testen, Projektkonto festlegen/entfernen, Einstellungen öffnen, Logs anzeigen (redacted).
2. **Kontenverwaltung** – Liste mit Avatar/Login/Host/Auth/Enabled; Aktionen: Hinzufügen (PAT/SSH/GH-CLI, Host frei), Entfernen (mit Warnung, Cleanup Credential), Umbenennen, Testen, Standard setzen, Deaktivieren, Metadaten aktualisieren, Orgs/Scopes anzeigen.
3. **Projekte & Zuordnung** – bekannte Workspaces (aus `workspaceRegistry` + manuell), Git-Root-Erkennung, Remote-Policy (HTTPS/SSH/Auto), Owner/Branch/Actions-Overrides; Aktionen: Zuordnen, Ändern, Entfernen, auf Standard zurücksetzen, manuell hinzufügen (DirectoryPicker), Auto-Erkennung via Git-Root.

**Zustände** (deutsche Labels, farbcodiert + Text, nicht nur Farbe): verbunden, nicht verbunden, Token abgelaufen, Berechtigung fehlt, Host unerreichbar, SSH-Key fehlt, SSH-Auth fehlgeschlagen, GH-CLI fehlt, mehrere Konten erkannt, kein Konto konfiguriert, verwendet globales Standardkonto/eigenes Konto.

**Schutz**: Vorschau vor Änderung, Reset, Remote-/Konto-Konfliktwarnung, Zugriffsprüfung (`GET /repos/{owner}/{repo}` → 404/403 → Warnung).

## 10. IPC & Validierung

Kanäle (`ipcMain.handle`): `github:getConfig`, `github:setConfig`, `github:addAccount`, `github:updateAccount`, `github:removeAccount`, `github:setDefaultAccount`, `github:testConnection`, `github:resolveEffective`, `github:setProjectBinding`, `github:removeProjectBinding`, `github:listWorkspaces`, `github:gitOperation`, `github:apiRequest`.

Jeder Handler: `validateIpcSender(event)` + `validate*Schema(request)` (unknown → geprüft, kein `any`), Pfad-Normalisierung + Traversal-Abwehr (`!path.isAbsolute → reject`, `realpath` + `startsWith` Check), `redact` vor Throw. Preload exponiert nur `window.__DSH_GITHUB__.*` (kein generisches `invoke`).

## 11. Agent-Integration

Vor jeder Agent-Git/GitHub-Aktion löst der Main-Hook den Kontext auf (`workspace → Git-Root → Remote → projectBinding → globalDefault → credentials`). Agent zeigt in Chat/Trajectory nur nicht-sensitives: `Konto: Arbeit | Benutzer: work-user | Host: github.com | Quelle: Projektzuordnung | Auth: SSH | Repo: org/repo`. Nie Token/Passphrase/Keys. Riskante Aktionen verlangen strukturierte Bestätigung (Ask-User-Tool mit Konto/Remote/Branch-Vorschau).

Implementierung: Wrapper um `dsh-bash-local`/`dsh-tool-bash` + `dsh-api` Remote, der vor `git push/clone` den Resolver aufruft und Env setzt. Falls kein Konto → `GITHUB_AUTH_REQUIRED` mit Handlungsanweisung statt stiller Ausführung.

## 12. Teststrategie

- **Unit** – Account-ID (UUID), Resolver-Priorität (alle 5 Stufen), Git-Root-Normierung (Windows Groß/Klein, Symlink, Laufwerk, Slash), Remote-Parsing (HTTPS/SSH/`gh`), GHES-Erkennung, SSH-Alias, Credential-Ref, Scope→Capability, Konflikt-Erkennung, Migration v0→v1, Secret-Masking.
- **Integration** – Konto hinzufügen/entfernen, Standardwechsel, Projektbindung setzen/entfernen, Verbindungstest (mock fetch/ssh), `git push` mit Konto A vs B (spawn-Arg-Assert), gleicher Host zwei Konten, GHES-Host, SSH vs HTTPS, Agent-Aufruf mit/ohne Konto, fehlende/abgelaufene Credentials, fehlende Scopes.
- **Security** – kein Token in Logs/UI (`assertNoSecrets`), Path-Traversal (`../` abgelehnt), Command-Injection (`; rm` in Label wird nicht evaluiert), manipulierte Remote-URL, unberechtigter IPC (falscher senderFrame), Renderer kann keine Main-Funktionen direkt importieren.
- **Manuell** – `npm test`, `npm run typecheck`, `npm run build`, echte App mit zwei GitHub-Konten, Safe Mode, Plugin-Deaktivierung, bestehende Workspaces unbeschadet.

## 13. Bekannte Einschränkungen (vertikale Scheibe zuerst)

- OAuth Device Flow & GitHub App Tokens initial nur dokumentiert + PAT als sichere Alternative (keine eigene OAuth-App im Repo).
- Gists: API vorhanden, UI nur „falls sinnvoll“ → initial nur `list/create` via API-Service, kein eigener Tab.
- Workflow-Logs: nur soweit API (`GET /repos/{owner}/{repo}/actions/runs/{id}/logs` → Zip, benötigt `actions:read`) – wenn API 403, UI erklärt fehlende Berechtigung.
- SSH: Passphrase nie persistiert; Agent-Nutzung nur wenn `SSH_AUTH_SOCK` vorhanden.
- Zwei Konten auf gleichem Host via HTTPS erfordern GCM mit kontoabhängigem `credential.useHttpPath` – auf Systemen ohne GCM Fallback auf temporäre `GIT_ASKPASS`-Helper.
- GitHub-Enterprise: getestet gegen `api/v3`-Pfad, nicht gegen jede GHES-Version.

## 14. Phasen

1. **Analyse** (erledigt) – siehe oben
2. **Datenmodell+Resolver** – shared Kontrakte, Stores, Utils, Resolver
3. **Auth** – Credential-Store, PAT/SSH/GH-CLI, Test
4. **Services+IPC** – Manager, API, Git-Operation, IPC-Verträge
5. **UI** – GitHub-Tab/Panel, Übersicht/Konten/Projekte
6. **Agent** – Kontext-Hook, Bestätigungen, Trajectory-Anzeige
7. **Tests+Doku+Build** – Full Regression, Doku `docs/github-accounts.md`

## 15. Offene Risiken

- Harness-Slot für Chat/Trajectory-Tab existiert nicht → Preload-Injektion als Fallback, muss gegen Harness-Updates robust (stabile `data-dsh-*` Marker).
- `safeStorage` auf Linux (Secret Service) nicht überall verfügbar → Fallback-Datei mit Warnhinweis.
- `realpathSync` auf nicht existierenden Pfaden schlägt fehl → Graceful Fallback auf `path.resolve`.
