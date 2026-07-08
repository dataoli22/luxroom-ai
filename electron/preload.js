const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('luxroom', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (partial) => ipcRenderer.invoke('settings:save', partial),
  },

  pipeline: {
    start: () => ipcRenderer.invoke('pipeline:start'),
    stop: () => ipcRenderer.invoke('pipeline:stop'),
    status: () => ipcRenderer.invoke('pipeline:status'),
    runNow: () => ipcRenderer.invoke('pipeline:run-now'),
  },

  listings: {
    getAll: () => ipcRenderer.invoke('listings:get-all'),
    get: (url) => ipcRenderer.invoke('listings:get', url),
    openUrl: (url) => ipcRenderer.invoke('listings:open-url', url),
  },

  scan: {
    onComplete: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('scan:complete', handler);
      return () => ipcRenderer.removeListener('scan:complete', handler);
    },
    onProgress: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('scan:progress', handler);
      return () => ipcRenderer.removeListener('scan:progress', handler);
    },
  },

  update: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('update:status', handler);
      return () => ipcRenderer.removeListener('update:status', handler);
    },
    onRecovery: (callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on('recovery:done', handler);
      return () => ipcRenderer.removeListener('recovery:done', handler);
    },
  },

  auth: {
    sources: () => ipcRenderer.invoke('auth:sources'),
    openLogin: (source) => ipcRenderer.invoke('auth:open-login', { source }),
    saveLogin: (source) => ipcRenderer.invoke('auth:save-login', { source }),
    cancelLogin: () => ipcRenderer.invoke('auth:cancel-login'),
    clearLogin: (source) => ipcRenderer.invoke('auth:clear-login', { source }),
    status: () => ipcRenderer.invoke('auth:status'),
  },

  approvals: {
    getPending: () => ipcRenderer.invoke('approvals:get-pending'),
    approve: (listingUrl, draftId, body) => ipcRenderer.invoke('approvals:approve', { listingUrl, draftId, body }),
    discard: (listingUrl, draftId) => ipcRenderer.invoke('approvals:discard', { listingUrl, draftId }),
    generateDraft: (listingUrl, type) => ipcRenderer.invoke('approvals:generate-draft', { listingUrl, type }),
    onChange: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('approvals:updated', handler);
      return () => ipcRenderer.removeListener('approvals:updated', handler);
    },
  },

  email: {
    test: (to, config) => ipcRenderer.invoke('email:test', { to, config }),
  },

  logs: {
    onLine: (callback) => {
      const handler = (_, line) => callback(line);
      ipcRenderer.on('log:line', handler);
      return () => ipcRenderer.removeListener('log:line', handler);
    },
  },

  hardware: {
    detect: () => ipcRenderer.invoke('hardware:detect'),
  },

  ai: {
    activeProvider: () => ipcRenderer.invoke('ai:active-provider'),
    status: () => ipcRenderer.invoke('ai:status'),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  },

  setup: {
    checkOllama:   ()      => ipcRenderer.invoke('setup:check-ollama'),
    installOllama: ()      => ipcRenderer.invoke('setup:install-ollama'),
    pullModel:     (model) => ipcRenderer.invoke('setup:pull-model', model),
    listModels:    ()      => ipcRenderer.invoke('setup:list-models'),
    removeModel:   (model) => ipcRenderer.invoke('setup:remove-model', model),
    onProgress: (callback) => {
      const handler = (_, data) => callback(data)
      ipcRenderer.on('setup:progress', handler)
      return () => ipcRenderer.removeListener('setup:progress', handler)
    },
  },
});
