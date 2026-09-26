window.__ModuleLoader__.load({
  id: 'dsh-desktop-github',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    const React = require('react')

    const NS = 'github'

    const zh = {
      title: 'GitHub',
      tabOverview: 'Übersicht',
      tabAccounts: 'Konten',
      tabProjects: 'Projekte',
      activeAccount: 'Aktives Konto',
      sourceSessionOverride: 'manuell temporär',
      sourceProjectBinding: 'Projektzuordnung',
      sourceRemoteMatch: 'Remote-Abgleich',
      sourceGlobalDefault: 'globaler Standard',
      sourceInteractiveRequired: 'Auswahl erforderlich',
      noAccount: 'Kein Konto',
      projectFolder: 'Projektordner',
      host: 'Host',
      auth: 'Auth',
      repository: 'Repository',
      testConnection: 'Verbindung testen',
      refresh: 'Aktualisieren',
      quickActions: 'Schnellaktionen',
      switchAccount: 'Konto wechseln',
      clearOverride: 'Session-Override entfernen',
      defaultAccount: 'Standardkonto',
      addAccount: 'Konto hinzufügen',
      labelPlaceholder: 'Label, z. B. Privat',
      githubLogin: 'GitHub login',
      tokenSecure: 'Token (sicher gespeichert)',
      add: 'Hinzufügen',
      noAccounts: 'Noch keine Konten',
      disabled: 'Deaktiviert',
      default: 'Standard',
      test: 'Testen',
      setDefault: 'Als Standard',
      rename: 'Umbenennen',
      remove: 'Entfernen',
      removeConfirm: 'Konto „{label}“ entfernen?',
      connectionOk: 'Verbindung OK',
      newLabel: 'Neues Label:',
      bindProject: 'Projekt zuordnen',
      projectPath: 'Projektpfad',
      browse: 'Auswählen',
      selectAccount: 'Konto wählen',
      save: 'Speichern',
      noBindings: 'Keine Projektbindungen',
      removeBindingConfirm: 'Zuordnung entfernen?',
      labelLoginRequired: 'Label und Benutzername sind erforderlich',
      projectPathAccountRequired: 'Projektpfad und Konto sind erforderlich',
      temporaryAccountPrompt: 'Temporäres Konto (ID) für diese Sitzung:'
    }

    const en = {
      title: 'GitHub',
      tabOverview: 'Overview',
      tabAccounts: 'Accounts',
      tabProjects: 'Projects',
      activeAccount: 'Active account',
      sourceSessionOverride: 'session override',
      sourceProjectBinding: 'project binding',
      sourceRemoteMatch: 'remote match',
      sourceGlobalDefault: 'global default',
      sourceInteractiveRequired: 'selection required',
      noAccount: 'No account',
      projectFolder: 'Project folder',
      host: 'Host',
      auth: 'Auth',
      repository: 'Repository',
      testConnection: 'Test connection',
      refresh: 'Refresh',
      quickActions: 'Quick actions',
      switchAccount: 'Switch account',
      clearOverride: 'Clear session override',
      defaultAccount: 'Default account',
      addAccount: 'Add account',
      labelPlaceholder: 'Label, e.g. Private',
      githubLogin: 'GitHub login',
      tokenSecure: 'Token (stored securely)',
      add: 'Add',
      noAccounts: 'No accounts yet',
      disabled: 'Disabled',
      default: 'Default',
      test: 'Test',
      setDefault: 'Set default',
      rename: 'Rename',
      remove: 'Remove',
      removeConfirm: 'Remove account “{label}”?',
      connectionOk: 'Connection OK',
      newLabel: 'New label:',
      bindProject: 'Bind project',
      projectPath: 'Project path',
      browse: 'Browse',
      selectAccount: 'Select account',
      save: 'Save',
      noBindings: 'No project bindings',
      removeBindingConfirm: 'Remove binding?',
      labelLoginRequired: 'Label and login are required',
      projectPathAccountRequired: 'Project path and account are required',
      temporaryAccountPrompt: 'Temporary account (ID) for this session:'
    }

    const css = `
      [data-dsh-github-root] { padding: 16px; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      [data-dsh-github-root] h2 { margin: 0 0 12px; font-size: 16px; color: var(--dsw-alias-label-primary, #202124); }
      [data-dsh-github-tabs] { display:flex; gap:8px; margin-bottom:12px; }
      [data-dsh-github-tabs] button { padding:6px 12px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: transparent; color: var(--dsw-alias-label-primary, #202124); cursor:pointer; font:inherit; font-size:13px; }
      [data-dsh-github-tabs] button[aria-selected="true"] { background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.06)); font-weight:600; }
      [data-dsh-github-tabs] button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 2px; }
      [data-dsh-github-card] { border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); border-radius:12px; padding:12px; margin-bottom:12px; background: var(--dsw-alias-bg-layer-1, #fff); }
      [data-dsh-github-card] h3 { margin:0 0 8px; font-size:13px; color: var(--dsw-alias-label-primary, #202124); }
      [data-dsh-github-row] { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:6px 0; font-size:13px; }
      [data-dsh-github-badge] { padding:2px 8px; border-radius:999px; font-size:11px; border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-layer-2, transparent); color: var(--dsw-alias-label-secondary, #666); }
      [data-dsh-github-actions] { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      [data-dsh-github-actions] button { padding:6px 10px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: transparent; color: var(--dsw-alias-label-primary, #202124); cursor:pointer; font-size:12px; }
      [data-dsh-github-actions] button:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04)); }
      [data-dsh-github-actions] button:disabled { opacity: .5; cursor: default; }
      [data-dsh-github-actions] button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 2px; }
      [data-dsh-github-input] { width:100%; padding:8px 10px; border-radius:8px; border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12)); background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #202124); font:inherit; font-size:13px; box-sizing:border-box; }
      [data-dsh-github-input]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #4d6bfe); outline-offset: 2px; }
      [data-dsh-github-list] { display:grid; gap:8px; }
      @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
    `

    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'github: copy dictionaries')

      ctx.effect(() => {
        if (document.querySelector('style[data-plugin-css="dsh-desktop-github"]')) return
        const style = document.createElement('style')
        style.dataset.pluginCss = 'dsh-desktop-github'
        style.textContent = css
        document.head.appendChild(style)
        return () => style.remove()
      }, 'github: styles')

      const t = ctx.locale.bind(NS)

      function GitHubFooterButton() {
        return React.createElement('button', {
          type: 'button',
          title: t('title'),
          'aria-label': t('title'),
          onClick: () => window.dispatchEvent(new CustomEvent('dsh-github:toggle', { detail: { panel: 'github' } })),
          style: { width: 36, height: 36, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', background: 'transparent', cursor: 'pointer', color: 'var(--dsw-alias-label-primary, #202124)' }
        }, 'GH')
      }

      function GitHubPanel() {
        const [tab, setTab] = React.useState('overview')
        const [config, setConfig] = React.useState(null)
        const [status, setStatus] = React.useState(null)
        const [error, setError] = React.useState('')
        const [sessionOverride, setSessionOverride] = React.useState(null)

        const load = React.useCallback(async () => {
          try {
            const gh = window.__DSH_GITHUB__
            if (!gh) return
            const cfg = await gh.getConfig()
            setConfig(cfg)
            const st = await gh.getStatus()
            setStatus(st)
            setError('')
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          }
        }, [])

        React.useEffect(() => { void load() }, [load])

        return React.createElement('div', { 'data-dsh-github-root': true },
          React.createElement('h2', null, t('title')),
          error ? React.createElement('div', { role: 'alert', style: { color: 'var(--dsw-alias-state-error-primary, #b42318)', fontSize: 12, marginBottom: 8 } }, error) : null,
          React.createElement('div', { 'data-dsh-github-tabs': true, role: 'tablist' },
            React.createElement('button', { role: 'tab', 'aria-selected': tab === 'overview', onClick: () => setTab('overview') }, t('tabOverview')),
            React.createElement('button', { role: 'tab', 'aria-selected': tab === 'accounts', onClick: () => setTab('accounts') }, t('tabAccounts')),
            React.createElement('button', { role: 'tab', 'aria-selected': tab === 'projects', onClick: () => setTab('projects') }, t('tabProjects'))
          ),
          tab === 'overview' ? React.createElement(OverviewTab, { config, status, onRefresh: load, sessionOverride, setSessionOverride, t }) : null,
          tab === 'accounts' ? React.createElement(AccountsTab, { config, onRefresh: load, t }) : null,
          tab === 'projects' ? React.createElement(ProjectsTab, { config, onRefresh: load, t }) : null
        )
      }

      function OverviewTab({ config, status, onRefresh, sessionOverride, setSessionOverride, t }) {
        const resolved = status?.resolved
        const accounts = config?.accounts ?? []
        const activeAccount = resolved?.accountId ? accounts.find(a => a.id === resolved.accountId) : null
        const sourceLabel = resolved ? (
          resolved.source === 'session-override' ? t('sourceSessionOverride') :
          resolved.source === 'project-binding' ? t('sourceProjectBinding') :
          resolved.source === 'remote-match' ? t('sourceRemoteMatch') :
          resolved.source === 'global-default' ? t('sourceGlobalDefault') : t('sourceInteractiveRequired')
        ) : '–'

        const testConnection = async () => {
          if (!resolved?.accountId) return
          try {
            await window.__DSH_GITHUB__.testConnection(resolved.accountId)
            await onRefresh()
          } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
        }

        return React.createElement('div', null,
          React.createElement('div', { 'data-dsh-github-card': true },
            React.createElement('h3', null, t('activeAccount')),
            React.createElement('div', { 'data-dsh-github-row': true },
              React.createElement('span', { 'data-dsh-github-badge': true }, sourceLabel),
              activeAccount ? React.createElement('span', null, `${activeAccount.label} (@${activeAccount.login})`) : React.createElement('span', null, t('noAccount'))
            ),
            resolved ? React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)', display: 'grid', gap: 4, marginTop: 8 } },
              React.createElement('div', null, `${t('projectFolder')}: ${resolved.projectRoot ?? '–'}`),
              React.createElement('div', null, `${t('host')}: ${resolved.githubHost ?? '–'}`),
              React.createElement('div', null, `${t('auth')}: ${resolved.authMethod ?? '–'}`),
              React.createElement('div', null, `${t('repository')}: ${resolved.repository ?? '–'}`),
              resolved.warnings?.length > 0 ? React.createElement('div', { role: 'alert', style: { color: 'var(--dsw-alias-state-warning-primary, #b54708)' } }, resolved.warnings.join(' · ')) : null
            ) : null,
            React.createElement('div', { 'data-dsh-github-actions': true },
              React.createElement('button', { type: 'button', onClick: testConnection, disabled: !resolved?.accountId }, t('testConnection')),
              React.createElement('button', { type: 'button', onClick: onRefresh }, t('refresh'))
            )
          ),
          React.createElement('div', { 'data-dsh-github-card': true },
            React.createElement('h3', null, t('quickActions')),
            React.createElement('div', { 'data-dsh-github-actions': true },
              React.createElement('button', { type: 'button', onClick: () => {
                const input = window.prompt(t('temporaryAccountPrompt'))
                if (input) setSessionOverride(input)
              } }, t('switchAccount')),
              React.createElement('button', { type: 'button', onClick: () => setSessionOverride(null) }, t('clearOverride')),
              sessionOverride ? React.createElement('span', { 'data-dsh-github-badge': true }, `Override: ${sessionOverride}`) : null
            )
          ),
          React.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)' } },
            `${t('defaultAccount')}: ${config?.defaultAccountId ? (accounts.find(a => a.id === config.defaultAccountId)?.label ?? config.defaultAccountId) : '–'}`
          )
        )
      }

      function AccountsTab({ config, onRefresh, t }) {
        const [form, setForm] = React.useState({ label: '', login: '', host: 'github.com', authMethod: 'pat', token: '' })
        const [adding, setAdding] = React.useState(false)

        const addAccount = async () => {
          if (!form.label.trim() || !form.login.trim()) { window.alert(t('labelLoginRequired')); return }
          setAdding(true)
          try {
            await window.__DSH_GITHUB__.addAccount(form)
            setForm({ label: '', login: '', host: 'github.com', authMethod: 'pat', token: '' })
            await onRefresh()
          } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
          finally { setAdding(false) }
        }

        const accounts = config?.accounts ?? []

        return React.createElement('div', null,
          React.createElement('div', { 'data-dsh-github-card': true },
            React.createElement('h3', null, t('addAccount')),
            React.createElement('div', { style: { display: 'grid', gap: 8 } },
              React.createElement('input', { 'data-dsh-github-input': true, placeholder: t('labelPlaceholder'), value: form.label, onChange: e => setForm({ ...form, label: e.target.value }), 'aria-label': t('labelPlaceholder') }),
              React.createElement('input', { 'data-dsh-github-input': true, placeholder: t('githubLogin'), value: form.login, onChange: e => setForm({ ...form, login: e.target.value }), 'aria-label': t('githubLogin') }),
              React.createElement('input', { 'data-dsh-github-input': true, placeholder: 'Host (github.com)', value: form.host, onChange: e => setForm({ ...form, host: e.target.value }), 'aria-label': t('host') }),
              React.createElement('select', { value: form.authMethod, onChange: e => setForm({ ...form, authMethod: e.target.value }), style: { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' }, 'aria-label': t('auth') },
                React.createElement('option', { value: 'pat' }, 'PAT'),
                React.createElement('option', { value: 'ssh' }, 'SSH'),
                React.createElement('option', { value: 'gh-cli' }, 'GH CLI'),
                React.createElement('option', { value: 'ghe-pat' }, 'GHES PAT')
              ),
              React.createElement('input', { 'data-dsh-github-input': true, type: 'password', placeholder: t('tokenSecure'), value: form.token, onChange: e => setForm({ ...form, token: e.target.value }), 'aria-label': t('tokenSecure') }),
              React.createElement('button', { type: 'button', onClick: addAccount, disabled: adding, style: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', cursor: 'pointer', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' } }, adding ? '…' : t('add'))
            )
          ),
          React.createElement('div', { 'data-dsh-github-list': true },
            accounts.length === 0 ? React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } }, t('noAccounts')) :
            accounts.map(acc =>
              React.createElement('div', { key: acc.id, 'data-dsh-github-card': true },
                React.createElement('div', { 'data-dsh-github-row': true },
                  React.createElement('strong', null, acc.label),
                  React.createElement('span', null, `@${acc.login}`),
                  React.createElement('span', { 'data-dsh-github-badge': true }, acc.host),
                  React.createElement('span', { 'data-dsh-github-badge': true }, acc.authMethod),
                  !acc.enabled ? React.createElement('span', { 'data-dsh-github-badge': true, style: { background: 'var(--dsw-alias-state-error-bg, #fef3f2)' } }, t('disabled')) : null,
                  config.defaultAccountId === acc.id ? React.createElement('span', { 'data-dsh-github-badge': true, style: { background: 'var(--dsw-alias-state-success-bg, #ecfdf3)' } }, t('default')) : null
                ),
                React.createElement('div', { 'data-dsh-github-actions': true },
                  React.createElement('button', { type: 'button', onClick: async () => { try { await window.__DSH_GITHUB__.testConnection(acc.id); window.alert(t('connectionOk')) } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) } } }, t('test')),
                  React.createElement('button', { type: 'button', onClick: async () => { try { await window.__DSH_GITHUB__.setDefaultAccount(acc.id); await onRefresh() } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) } } }, t('setDefault')),
                  React.createElement('button', { type: 'button', onClick: async () => {
                    const v = window.prompt(t('newLabel'), acc.label)
                    if (v && v.trim()) { try { await window.__DSH_GITHUB__.updateAccount(acc.id, { label: v.trim() }); await onRefresh() } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) } }
                  } }, t('rename')),
                  React.createElement('button', { type: 'button', onClick: async () => {
                    if (!window.confirm(t('removeConfirm').replace('{label}', acc.label))) return
                    try { await window.__DSH_GITHUB__.removeAccount(acc.id); await onRefresh() } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
                  }, style: { color: 'var(--dsw-alias-state-error-primary, #b42318)' } }, t('remove'))
                )
              )
            )
          )
        )
      }

      function ProjectsTab({ config, onRefresh, t }) {
        const [form, setForm] = React.useState({ projectRoot: '', accountId: '', remotePolicy: 'auto' })
        const accounts = config?.accounts ?? []
        const bindings = config?.projectBindings ?? []

        const pickDirectory = async () => {
          try {
            const picked = await window.__DSH_DIRECTORY_PICKER__?.pick?.()
            if (picked) setForm({ ...form, projectRoot: picked })
          } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
        }

        const saveBinding = async () => {
          if (!form.projectRoot.trim() || !form.accountId) { window.alert(t('projectPathAccountRequired')); return }
          try {
            await window.__DSH_GITHUB__.setProjectBinding({ projectRoot: form.projectRoot.trim(), accountId: form.accountId, remotePolicy: form.remotePolicy })
            setForm({ projectRoot: '', accountId: '', remotePolicy: 'auto' })
            await onRefresh()
          } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
        }

        return React.createElement('div', null,
          React.createElement('div', { 'data-dsh-github-card': true },
            React.createElement('h3', null, t('bindProject')),
            React.createElement('div', { style: { display: 'grid', gap: 8 } },
              React.createElement('div', { style: { display: 'flex', gap: 8 } },
                React.createElement('input', { 'data-dsh-github-input': true, placeholder: t('projectPath'), value: form.projectRoot, onChange: e => setForm({ ...form, projectRoot: e.target.value }), style: { flex: 1 }, 'aria-label': t('projectPath') }),
                React.createElement('button', { type: 'button', onClick: pickDirectory, style: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', cursor: 'pointer', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' } }, t('browse'))
              ),
              React.createElement('select', { value: form.accountId, onChange: e => setForm({ ...form, accountId: e.target.value }), style: { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' }, 'aria-label': t('selectAccount') },
                React.createElement('option', { value: '' }, t('selectAccount')),
                accounts.map(a => React.createElement('option', { key: a.id, value: a.id }, `${a.label} (@${a.login})`))
              ),
              React.createElement('select', { value: form.remotePolicy, onChange: e => setForm({ ...form, remotePolicy: e.target.value }), style: { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' }, 'aria-label': 'Remote policy' },
                React.createElement('option', { value: 'auto' }, 'Auto'),
                React.createElement('option', { value: 'https' }, 'HTTPS'),
                React.createElement('option', { value: 'ssh' }, 'SSH')
              ),
              React.createElement('button', { type: 'button', onClick: saveBinding, style: { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))', cursor: 'pointer', background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #202124)' } }, t('save'))
            )
          ),
          React.createElement('div', { 'data-dsh-github-list': true },
            bindings.length === 0 ? React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #666)' } }, t('noBindings')) :
            bindings.map(b => {
              const acc = accounts.find(a => a.id === b.accountId)
              return React.createElement('div', { key: b.projectRoot, 'data-dsh-github-card': true },
                React.createElement('div', { 'data-dsh-github-row': true },
                  React.createElement('strong', { style: { wordBreak: 'break-all' } }, b.projectRoot),
                  React.createElement('span', { 'data-dsh-github-badge': true }, acc ? acc.label : b.accountId),
                  React.createElement('span', { 'data-dsh-github-badge': true }, b.remotePolicy)
                ),
                React.createElement('div', { 'data-dsh-github-actions': true },
                  React.createElement('button', { type: 'button', onClick: async () => {
                    if (!window.confirm(t('removeBindingConfirm'))) return
                    try { await window.__DSH_GITHUB__.removeProjectBinding(b.projectRoot); await onRefresh() } catch (e) { window.alert(e instanceof Error ? e.message : String(e)) }
                  }, style: { color: 'var(--dsw-alias-state-error-primary, #b42318)' } }, t('remove'))
                )
              )
            })
          )
        )
      }

      ctx.slots.inject('sidebar.panel', () =>
        ctx.slots.register({
          name: 'sidebar.panel',
          id: 'desktop-github',
          order: 200,
          inject: () => ({})
        }, GitHubPanel)
      )

      ctx.slots.inject('sidebar.footer.action', () =>
        ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'desktop-github-footer',
          order: 350
        }, GitHubFooterButton)
      )
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
