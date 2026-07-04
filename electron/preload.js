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
  },

  approvals: {
    getPending: () => ipcRenderer.invoke('approvals:get-pending'),
    approve: (listingUrl, draftId) => ipcRenderer.invoke('approvals:approve', { listingUrl, draftId }),
    discard: (listingUrl, draftId) => ipcRenderer.invoke('approvals:discard', { listingUrl, draftId }),
    generateDraft: (listingUrl, type) => ipcRenderer.invoke('approvals:generate-draft', { listingUrl, type }),
    onChange: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('approvals:updated', handler);
      return () => ipcRenderer.removeListener('approvals:updated', handler);
    },
  },

  email: {
    test: (to) => ipcRenderer.invoke('email:test', { to }),
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
