import { contextBridge, ipcRenderer } from 'electron'

export function exposeGitHubBridge(): void {
  contextBridge.exposeInMainWorld('__DSH_GITHUB__', Object.freeze({
    getConfig: (): Promise<unknown> => ipcRenderer.invoke('github:getConfig'),
    addAccount: (input: unknown): Promise<unknown> => ipcRenderer.invoke('github:addAccount', input),
    updateAccount: (accountId: string, patch: unknown): Promise<unknown> => ipcRenderer.invoke('github:updateAccount', accountId, patch),
    removeAccount: (accountId: string): Promise<unknown> => ipcRenderer.invoke('github:removeAccount', accountId),
    setDefaultAccount: (accountId: string): Promise<unknown> => ipcRenderer.invoke('github:setDefaultAccount', accountId),
    testConnection: (accountId: string): Promise<unknown> => ipcRenderer.invoke('github:testConnection', accountId),
    resolveEffective: (request: unknown): Promise<unknown> => ipcRenderer.invoke('github:resolveEffective', request),
    setProjectBinding: (input: unknown): Promise<unknown> => ipcRenderer.invoke('github:setProjectBinding', input),
    removeProjectBinding: (projectRoot: string): Promise<unknown> => ipcRenderer.invoke('github:removeProjectBinding', projectRoot),
    apiRequest: (options: unknown): Promise<unknown> => ipcRenderer.invoke('github:apiRequest', options),
    gitOperation: (request: unknown): Promise<unknown> => ipcRenderer.invoke('github:gitOperation', request),
    getStatus: (workspacePath?: string): Promise<unknown> => ipcRenderer.invoke('github:getStatus', workspacePath),
    configureSsh: (input: unknown): Promise<unknown> => ipcRenderer.invoke('github:configureSsh', input),
    removeSshConfig: (accountId: string): Promise<unknown> => ipcRenderer.invoke('github:removeSshConfig', accountId),
    getSshBlocks: (): Promise<unknown> => ipcRenderer.invoke('github:getSshBlocks'),
    agentContext: (input: unknown): Promise<unknown> => ipcRenderer.invoke('github:agentContext', input)
  }))
}
