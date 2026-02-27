const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Redis connection operations
  redisTest: (config) => ipcRenderer.invoke('redis:test', config),
  redisConnect: (id, config) => ipcRenderer.invoke('redis:connect', id, config),
  redisDisconnect: (id) => ipcRenderer.invoke('redis:disconnect', id),

  // Key operations
  redisScan: (id, pattern, count) =>
    ipcRenderer.invoke('redis:scan', id, pattern, count),
  redisKeyInfo: (id, key) => ipcRenderer.invoke('redis:keyInfo', id, key),
  redisGet: (id, key) => ipcRenderer.invoke('redis:get', id, key),
  redisSet: (id, key, type, value) =>
    ipcRenderer.invoke('redis:set', id, key, type, value),
  redisDelete: (id, key) => ipcRenderer.invoke('redis:delete', id, key),
  redisRename: (id, key, newKey) =>
    ipcRenderer.invoke('redis:rename', id, key, newKey),

  // TTL operations
  redisSetTTL: (id, key, seconds) =>
    ipcRenderer.invoke('redis:setTTL', id, key, seconds),
  redisClearTTL: (id, key) => ipcRenderer.invoke('redis:clearTTL', id, key),

  // Database info
  redisInfo: (id) => ipcRenderer.invoke('redis:info', id),
  redisSelectDb: (id, db) => ipcRenderer.invoke('redis:selectDb', id, db),

  // Java deserialization
  javaDeserialize: (byteArray) => ipcRenderer.invoke('java:deserialize', byteArray),

  // Config storage (persistent file-based storage)
  saveConfig: (key, data) => ipcRenderer.invoke('config:save', key, data),
  loadConfig: (key) => ipcRenderer.invoke('config:load', key),
  getUserDataPath: () => ipcRenderer.invoke('config:getUserDataPath'),
})