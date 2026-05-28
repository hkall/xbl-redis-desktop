const { contextBridge, ipcRenderer, shell } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Redis connection operations
  redisTest: (config) => ipcRenderer.invoke('redis:test', config),
  redisConnect: (id, config) => ipcRenderer.invoke('redis:connect', id, config),
  redisDisconnect: (id) => ipcRenderer.invoke('redis:disconnect', id),

  // Key operations
  redisScan: (id, pattern, count, cursor) =>
    ipcRenderer.invoke('redis:scan', id, pattern, count, cursor),
  redisKeyInfo: (id, key) => ipcRenderer.invoke('redis:keyInfo', id, key),
  redisGet: (id, key) => ipcRenderer.invoke('redis:get', id, key),
  redisSet: (id, key, type, value) =>
    ipcRenderer.invoke('redis:set', id, key, type, value),
  redisDelete: (id, key) => ipcRenderer.invoke('redis:delete', id, key),
  redisRename: (id, key, newKey) =>
    ipcRenderer.invoke('redis:rename', id, key, newKey),

  // Hash pagination
  redisHscan: (id, key, cursor, count) =>
    ipcRenderer.invoke('redis:hscan', id, key, cursor, count),

  // TTL operations
  redisSetTTL: (id, key, seconds) =>
    ipcRenderer.invoke('redis:setTTL', id, key, seconds),
  redisClearTTL: (id, key) => ipcRenderer.invoke('redis:clearTTL', id, key),

  // Database info
  redisInfo: (id) => ipcRenderer.invoke('redis:info', id),
  redisSelectDb: (id, db) => ipcRenderer.invoke('redis:selectDb', id, db),
  redisDbSize: (id) => ipcRenderer.invoke('redis:dbsize', id),

  // New features
  redisExecuteCommand: (id, command) => ipcRenderer.invoke('redis:executeCommand', id, command),
  redisGetServerInfo: (id, section) => ipcRenderer.invoke('redis:getServerInfo', id, section),

  // Java deserialization
  javaDeserialize: (byteArray) => ipcRenderer.invoke('java:deserialize', byteArray),

  // Archive operations
  createAndDownloadArchive: (options) => ipcRenderer.invoke('archive:createAndDownload', options),

  // Config storage (persistent file-based storage)
  saveConfig: (key, data) => ipcRenderer.invoke('config:save', key, data),
  loadConfig: (key) => ipcRenderer.invoke('config:load', key),
  getUserDataPath: () => ipcRenderer.invoke('config:getUserDataPath'),

  // Open external URL in default browser
  openExternal: (url) => shell.openExternal(url),

  // Update download
  downloadUpdate: (url, filename) => ipcRenderer.invoke('update:download', url, filename),
  openUpdateFile: (filePath) => ipcRenderer.invoke('update:openFile', filePath),
  openUpdateFolder: (folderPath) => ipcRenderer.invoke('update:openFolder', folderPath),
  onUpdateProgress: (callback) => ipcRenderer.on('update:progress', (_event, data) => callback(data)),

  // HTTP Request (API Tester)
  httpRequest: (config) => ipcRenderer.invoke('http:request', config),
  httpCancel: (requestId) => ipcRenderer.invoke('http:cancel', requestId),

  // Database operations (MySQL, etc.)
  dbTestConnection: (config) => ipcRenderer.invoke('db:testConnection', config),
  dbCreateConnection: (connectionId, config) => ipcRenderer.invoke('db:createConnection', connectionId, config),
  dbCloseConnection: (id) => ipcRenderer.invoke('db:closeConnection', id),
  dbExecuteQuery: (id, sql, database) => ipcRenderer.invoke('db:executeQuery', id, sql, database),
  dbGetDatabases: (id) => ipcRenderer.invoke('db:getDatabases', id),
  dbGetTables: (id, database) => ipcRenderer.invoke('db:getTables', id, database),
  dbGetColumns: (id, database, table) => ipcRenderer.invoke('db:getColumns', id, database, table),
  dbGetProcedures: (id, database) => ipcRenderer.invoke('db:getProcedures', id, database),
  dbGetTriggers: (id, database) => ipcRenderer.invoke('db:getTriggers', id, database),
  dbGetDatabaseInfo: (id, database) => ipcRenderer.invoke('db:getDatabaseInfo', id, database),
  dbGetTableData: (id, database, table, options) => ipcRenderer.invoke('db:getTableData', id, database, table, options),
  dbGetTableStructure: (id, database, table) => ipcRenderer.invoke('db:getTableStructure', id, database, table),

  dbInsertRow: (id, database, table, rowData) => ipcRenderer.invoke('db:insertRow', id, database, table, rowData),
  dbUpdateRow: (id, database, table, primaryKey, rowData) => ipcRenderer.invoke('db:updateRow', id, database, table, primaryKey, rowData),
  dbDeleteRows: (id, database, table, primaryKeys) => ipcRenderer.invoke('db:deleteRows', id, database, table, primaryKeys),

  // AI请求 - 绕过浏览器CORS限制
  aiRequest: (config) => ipcRenderer.invoke('ai:request', config),

  // 用于渲染进程生成唯一ID
  generateRequestId: () => crypto.randomUUID(),
})