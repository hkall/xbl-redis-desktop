const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs').promises
const Redis = require('ioredis')
const jos = require('java-object-serialization')

// Add debug logging function
let debugLogStream = null
async function setupDebugLogging() {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs')
    await fs.mkdir(logDir, { recursive: true })
    const logFile = path.join(logDir, 'debug.log')
    debugLogStream = require('fs').createWriteStream(logFile, { flags: 'a' })
    console.log('[Debug] Logging to:', logFile)
  } catch (error) {
    console.error('[Debug] Failed to setup logging:', error)
  }
}

function debugLog(...args) {
  const message = args.map(arg =>
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ')
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(logMessage)
  if (debugLogStream) {
    debugLogStream.write(logMessage)
  }
}

// Get class references for instanceof checks
const JavaObject = jos.JavaObject

let mainWindow = null

// Get config file path
function getConfigFilePath() {
  const configDir = path.join(app.getPath('userData'), 'config')
  const filePath = path.join(configDir, 'connections.json')
  return filePath
}

// Ensure config directory exists
async function ensureConfigDir() {
  const configDir = path.join(app.getPath('userData'), 'config')
  try {
    await fs.access(configDir)
  } catch {
    await fs.mkdir(configDir, { recursive: true })
  }
}

// Store active Redis connections
const redisConnections = new Map()

function deserializeJavaBytes(bytes) {
  try {
    const input = new jos.ObjectInputStream(new Uint8Array(bytes))
    const result = input.readObject()

    // Convert the result to a format suitable for IPC serialization
    function convertToSerializable(obj, depth = 0) {
      const MAX_DEPTH = 50
      if (depth > MAX_DEPTH) {
        return `<max depth reached: ${MAX_DEPTH}>`
      }

      if (obj === null || obj === undefined) {
        return null
      }

      // Handle JavaObject - detect by structure (has className, fields, serialVersionUid)
      if (obj && typeof obj === 'object' &&
          obj.constructor && obj.constructor.name === 'JavaObject') {
        const converted = {
          className: obj.className,
          serialVersionUid: obj.serialVersionUid?.toString?.() || String(obj.serialVersionUid || 'unknown'),
          fields: [],
          annotations: Array.isArray(obj.annotations) ? obj.annotations.map(a => convertToSerializable(a, depth + 1)) : [],
          value: {}
        }

        // The fields Map holds the actual field values
        if (obj.fields && typeof obj.fields.entries === 'function') {
          for (const [fieldName, fieldValue] of obj.fields.entries()) {
            converted.value[fieldName] = convertToSerializable(fieldValue, depth + 1)
            converted.fields.push({
              name: fieldName,
              typeCode: typeof fieldValue === 'object' && fieldValue !== null ? 'L' : getPrimitiveType(fieldValue),
              typeName: typeof fieldValue === 'object' && fieldValue !== null ? (fieldValue.className || typeof fieldValue) : typeof fieldValue
            })
          }
        }

        return converted
      }

      // Handle objects with JavaObject structure (nested JavaObjects)
      if (obj && typeof obj === 'object' && obj.className && obj.fields && obj.serialVersionUid !== undefined) {
        // Convert fields Map entries
        const converted = {
          className: obj.className,
          serialVersionUid: obj.serialVersionUid?.toString?.() || String(obj.serialVersionUid || 'unknown'),
          fields: [],
          annotations: Array.isArray(obj.annotations) ? obj.annotations.map(a => convertToSerializable(a, depth + 1)) : [],
          value: {}
        }

        if (obj.fields && typeof obj.fields.entries === 'function') {
          for (const [fieldName, fieldValue] of obj.fields.entries()) {
            converted.value[fieldName] = convertToSerializable(fieldValue, depth + 1)
            converted.fields.push({
              name: fieldName,
              typeCode: typeof fieldValue === 'object' && fieldValue !== null ? 'L' : getPrimitiveType(fieldValue),
              typeName: typeof fieldValue === 'object' && fieldValue !== null ? (fieldValue.className || typeof fieldValue) : typeof fieldValue
            })
          }
        }

        return converted
      }

      // Handle Handle objects from java-object-serialization
      if (obj && typeof obj === 'object' && 'object' in obj) {
        return convertToSerializable(obj.object, depth + 1)
      }

      // Handle Maps - check by typeof Map and has entries method
      if (obj && typeof Map !== 'undefined' && obj.constructor && obj.constructor.name === 'Map') {
        const result = {}
        for (const [key, value] of obj.entries()) {
          result[String(key)] = convertToSerializable(value, depth + 1)
        }
        return result
      }

      // Handle Sets
      if (obj && typeof Set !== 'undefined' && obj.constructor && obj.constructor.name === 'Set') {
        const result = []
        for (const item of obj) {
          result.push(convertToSerializable(item, depth + 1))
        }
        return result
      }

      // Handle Arrays
      if (Array.isArray(obj)) {
        return obj.map(item => convertToSerializable(item, depth + 1))
      }

      // Handle BigInt
      if (typeof obj === 'bigint') {
        return { type: 'bigint', value: obj.toString() }
      }

      // Handle Date
      if (obj && typeof Date !== 'undefined' && obj.constructor && obj.constructor.name === 'Date') {
        return { type: 'date', value: obj.toISOString() }
      }

      // Handle Buffer/Uint8Array
      if (obj && obj.constructor && (obj.constructor.name === 'Buffer' || obj.constructor.name === 'Uint8Array')) {
        return Array.from(obj)
      }

      // Handle other objects
      if (typeof obj === 'object') {
        const result = {}
        for (const [key, value] of Object.entries(obj)) {
          result[key] = convertToSerializable(value, depth + 1)
        }
        return result
      }

      // Return primitives as-is
      return obj
    }

    // Helper function to get primitive type code
    function getPrimitiveType(value) {
      if (typeof value === 'string') return 'Ljava/lang/String;'
      if (typeof value === 'number') return Number.isInteger(value) ? 'I' : 'D'
      if (typeof value === 'boolean') return 'Z'
      if (typeof value === 'bigint') return 'J'
      return 'L'
    }

    const finalResult = convertToSerializable(result)
    return finalResult
  } catch (error) {
    console.error('Failed to deserialize Java object:', error)
    throw error
  }
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    resizable: true,
    frame: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Xbl Redis Desktop'
  })

  if (process.env.NODE_ENV === 'development') {
    // Wait for Vite to be ready before loading
    const loadWithRetry = async (retryCount = 0) => {
      try {
        // Test if Vite is ready - try multiple ports
        const ports = [5173, 5174, 5175, 5176, 5177]
        for (const port of ports) {
          try {
            const response = await fetch(`http://localhost:${port}`)
            if (response.ok) {
              mainWindow.loadURL(`http://localhost:${port}`)
              mainWindow.webContents.openDevTools()
              return
            }
          } catch (e) {
            // Try next port
          }
        }
        throw new Error('Server not ready')
      } catch (error) {
        if (retryCount < 60) { // Retry up to 60 times (30 seconds)
          setTimeout(() => loadWithRetry(retryCount + 1), 500)
        } else {
          console.error('Failed to connect to Vite dev server after 30 seconds')
          mainWindow.loadFile(path.join(__dirname, 'index.html'))
        }
      }
    }

    loadWithRetry()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  createWindow()
  // Setup debug logging after window creation
  await setupDebugLogging()
  // Hide menu bar on Windows
  if (process.platform === 'win32') {
    Menu.setApplicationMenu(null)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  for (const [id, client] of redisConnections.entries()) {
    client.quit().catch(console.error)
  }
  redisConnections.clear()
})

// IPC Handlers

ipcMain.handle('redis:test', async (_event, config) => {
  try {
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: 5000,
      lazyConnect: true,
      returnBuffers: true,
    })

    await client.connect()
    await client.ping()
    await client.quit()

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
})

ipcMain.handle('redis:connect', async (_event, id, config) => {
  try {
    // Check if already connected, just disconnect first
    const existingClient = redisConnections.get(id)
    if (existingClient) {
      await existingClient.quit()
      redisConnections.delete(id)
    }

    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      lazyConnect: true,
      returnBuffers: true,
    })

    await client.connect()
    redisConnections.set(id, client)

    return { success: true, db: config.db || 0 }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
})

ipcMain.handle('redis:disconnect', async (_event, id) => {
  try {
    const client = redisConnections.get(id)
    if (client) {
      await client.quit()
      redisConnections.delete(id)
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Disconnection failed',
    }
  }
})

ipcMain.handle('redis:scan', async (_event, id, pattern = '*', count = 100, cursor = '0') => {
  console.log('[redis:scan] Called with id:', id, 'pattern:', pattern, 'count:', count, 'cursor:', cursor)
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const keys = []
    const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', count)
    console.log('[redis:scan] Scan result - nextCursor:', nextCursor, 'batch length:', batch ? batch.length : 0)
    // Convert buffers to strings
    const keysFromBatch = batch.map(key => {
      const str = key.toString()
      console.log('[redis:scan] Key (Buffer):', key, '-> String:', str)
      return str
    })
    keys.push(...keysFromBatch)

    console.log('[redis:scan] Returning', keys.length, 'keys')
    return { success: true, data: keys, cursor: nextCursor }
  } catch (error) {
    console.error('[redis:scan] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan keys',
    }
  }
})

ipcMain.handle('redis:keyInfo', async (_event, id, key) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const [type, ttl] = await Promise.all([
      client.type(key),
      client.ttl(key),
    ])

    let size = 0
    switch (type) {
      case 'string': size = (await client.get(key))?.length || 0; break
      case 'hash': size = await client.hlen(key); break
      case 'list': size = await client.llen(key); break
      case 'set': size = await client.scard(key); break
      case 'zset': size = await client.zcard(key); break
    }

    if (type === 'none') {
      return { success: false, error: 'Key does not exist' }
    }

    return {
      success: true,
      data: { name: key, type, ttl, size },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get key info',
    }
  }
})

ipcMain.handle('redis:get', async (_event, id, key) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const type = await client.type(key)

    switch (type) {
      case 'string': {
        // 先用 get 获取字符串，ioredis 会自动处理 UTF-8 编码
        const value = await client.get(key)

        // 检查是否是 Java 序列化对象 (通过尝试解析 header)
        // 注意：这里我们需要再次获取 buffer 来检查
        const buffer = await client.getBuffer(key)
        const isJavaSerialization = buffer.length >= 2 &&
                                     buffer[0] === 0xAC &&
                                     buffer[1] === 0xED &&
                                     buffer.length > 32

        if (isJavaSerialization) {
          return {
            success: true,
            data: Array.from(buffer),
            encoding: 'java-binary',
            isJavaSerialization: true,
            originalLength: buffer.length
          }
        }

        // 直接返回解码的字符串
        return { success: true, data: value, encoding: 'utf-8' }
      }

      case 'hash': return { success: true, data: await client.hgetall(key) }
      case 'list': return { success: true, data: await client.lrange(key, 0, -1) }
      case 'set': return { success: true, data: await client.smembers(key) }
      case 'zset': {
        const members = await client.zrange(key, 0, -1, 'WITHSCORES')
        const result = []
        for (let i = 0; i < members.length; i += 2) {
          result.push({ member: members[i], score: parseFloat(members[i + 1]) })
        }
        return { success: true, data: result }
      }

      default:
        throw new Error(`Unsupported data type: ${type}`)
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get value',
    }
  }
})

ipcMain.handle('redis:set', async (_event, id, key, type, value) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    switch (type) {
      case 'string': await client.set(key, value); break
      case 'hash':
        if (value.action === 'deleteField') {
          console.log(`[redis:set] Deleting hash field "${value.field}" from key "${key}"`)
          const result = await client.hdel(key, value.field)
          console.log(`[redis:set] HDEL result: ${result} fields deleted`)
        } else {
          console.log(`[redis:set] Setting hash field "${value.field}" for key "${key}"`)
          await client.hset(key, value.field, value.value)
        }
        break
      case 'list':
        if (value.action === 'push') {
          if (value.direction === 'left') await client.lpush(key, value.value)
          else await client.rpush(key, value.value)
        } else if (value.action === 'set') await client.lset(key, value.index, value.value)
        else if (value.action === 'remove') await client.lrem(key, 0, value.value)
        break
      case 'set':
        if (value.action === 'add') await client.sadd(key, value.member)
        else if (value.action === 'remove') await client.srem(key, value.member)
        break
      case 'zset':
        if (value.action === 'add') await client.zadd(key, value.score, value.member)
        else if (value.action === 'update') await client.zadd(key, value.score, value.member)
        else if (value.action === 'remove') await client.zrem(key, value.member)
        break
      default:
        throw new Error(`Unsupported data type: ${type}`)
    }

    return { success: true }
  } catch (error) {
    console.error('[redis:set] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set value',
    }
  }
})

ipcMain.handle('redis:delete', async (_event, id, key) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    await client.del(key)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete key',
    }
  }
})

ipcMain.handle('redis:rename', async (_event, id, key, newKey) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    await client.rename(key, newKey)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rename key',
    }
  }
})

ipcMain.handle('redis:setTTL', async (_event, id, key, seconds) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    // Check if key exists before operating
    const exists = await client.exists(key)

    if (exists === 0) {
      return { success: true, warning: 'Key does not exist' }
    }

    // Treat any value <= 0 as persistent (no expiration)
    if (seconds <= 0) {
      const result = await client.persist(key)
    } else {
      const result = await client.expire(key, seconds)
    }

    return { success: true }
  } catch (error) {
    console.error('[redis:setTTL] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set TTL',
    }
  }
})

ipcMain.handle('redis:clearTTL', async (_event, id, key) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    await client.persist(key)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear TTL',
    }
  }
})

ipcMain.handle('redis:info', async (_event, id) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const info = await client.info('keyspace')
    const dbs = {}

    const lines = info.split('\n')
    for (const line of lines) {
      const match = line.match(/^db(\d+):keys=(\d+)/)
      if (match) {
        dbs[match[1]] = parseInt(match[2], 10)
      }
    }

    return { success: true, data: dbs }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get info',
    }
  }
})

ipcMain.handle('redis:selectDb', async (_event, id, db) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    await client.select(db)

    return { success: true }
  } catch (error) {
    console.error('Failed to select database:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to select database',
    }
  }
})

ipcMain.handle('java:deserialize', async (_event, byteArray) => {
  try {
    const bytes = Array.isArray(byteArray) ? new Uint8Array(byteArray) : byteArray
    const result = deserializeJavaBytes(bytes)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Java deserialization failed',
    }
  }
})

// Config storage handlers - file-based persistent storage
ipcMain.handle('config:save', async (_event, key, data) => {
  try {
    await ensureConfigDir()
    const configPath = getConfigFilePath()

    // Read existing config
    let config = {}
    try {
      const content = await fs.readFile(configPath, 'utf-8')
      config = JSON.parse(content)
    } catch (err) {
      // File doesn't exist or is invalid, start fresh
    }

    // Update config
    config[key] = data

    // Write back
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')

    return { success: true }
  } catch (error) {
    console.error('Failed to save config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save config',
    }
  }
})

ipcMain.handle('config:load', async (_event, key) => {
  try {
    const configPath = getConfigFilePath()

    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content)

    return { success: true, data: config[key] }
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Config file doesn't exist yet
      return { success: true, data: null }
    }
    console.error('Failed to load config:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load config',
    }
  }
})

ipcMain.handle('config:getUserDataPath', async () => {
  return { success: true, data: app.getPath('userData') }
})

// Execute custom Redis command
ipcMain.handle('redis:executeCommand', async (_event, id, command) => {
  debugLog('[redis:executeCommand] Called with:', { id, command })

  try {
    const client = redisConnections.get(id)
    if (!client) {
      debugLog('[redis:executeCommand] No client found for id:', id)
      throw new Error('Not connected to Redis')
    }

    const parts = command.trim().split(/\s+/)
    const cmd = parts[0].toUpperCase()
    const args = parts.slice(1)

    // For GET commands, check for Java serialization and return byte array
    if (cmd === 'GET' && args.length > 0) {
      const key = args[0]

      // Always use getBuffer for GET commands to detect Java serialization
      const buffer = await client.getBuffer(key)

      // Handle null case (key does not exist)
      if (buffer === null) {
        debugLog('[redis:executeCommand] GET result: null (key not found)')
        return {
          success: true,
          data: null,
          command: cmd
        }
      }

      debugLog('[redis:executeCommand] GET result:', {
        key,
        bufferLength: buffer.length,
        first10Bytes: Array.from(buffer.slice(0, 10)),
        hex: Array.from(buffer.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ')
      })

      // Check if it's a Java serialized object
      const isJavaSerialization = buffer.length >= 2 &&
                                   buffer[0] === 0xAC &&
                                   buffer[1] === 0xED &&
                                   buffer.length > 32

      debugLog('[redis:executeCommand] Is Java serialization:', isJavaSerialization)

      if (isJavaSerialization) {
        debugLog('[redis:executeCommand] Returning Java binary data')
        return {
          success: true,
          data: Array.from(buffer),
          encoding: 'java-binary',
          command: cmd
        }
      }

      // For non-Java objects, return decoded string
      debugLog('[redis:executeCommand] Not Java serialization, getting string value')
      const value = buffer.toString('utf-8')
      debugLog('[redis:executeCommand] Returning string value, length:', value?.length)
      return {
        success: true,
        data: value,
        command: cmd
      }
    }

    // For other commands, execute normally
    debugLog('[redis:executeCommand] Executing:', { cmd, args })

    const result = await client.send_command(cmd, ...args)

    debugLog('[redis:executeCommand] Result:', {
      type: typeof result,
      value: result
    })

    return {
      success: true,
      data: result,
      command: cmd
    }
  } catch (error) {
    debugLog('[redis:executeCommand] ERROR:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Command execution failed'
    }
  }
})

// Get Redis server info
ipcMain.handle('redis:getServerInfo', async (_event, id, section = 'default') => {
  try {
    console.log('[redis:getServerInfo] Called with:', { id, section })

    const client = redisConnections.get(id)
    if (!client) {
      console.error('[redis:getServerInfo] No client found for id:', id)
      throw new Error('Not connected to Redis')
    }

    console.log('[redis:getServerInfo] Client found, calling INFO')
    const info = await client.info(section)
    console.log('[redis:getServerInfo] INFO result length:', info.length)
    console.log('[redis:getServerInfo] INFO preview:', info.substring(0, 200))

    // Parse INFO output into object
    const parsedInfo = {}
    let currentSection = 'default'
    let lineCount = 0

    for (const line of info.split('\n')) {
      lineCount++
      if (line.startsWith('#')) {
        currentSection = line.slice(1).trim().toLowerCase()
        console.log(`[redis:getServerInfo] Section ${lineCount}:`, currentSection)
      } else if (line.includes(':')) {
        const colonIndex = line.indexOf(':')
        const key = line.substring(0, colonIndex)
        const value = line.substring(colonIndex + 1).trim()
        if (!parsedInfo[currentSection]) {
          parsedInfo[currentSection] = {}
        }
        parsedInfo[currentSection][key] = value
      }
    }

    console.log('[redis:getServerInfo] Parsed sections:', Object.keys(parsedInfo))
    console.log('[redis:getServerInfo] Total lines processed:', lineCount)

    return {
      success: true,
      data: parsedInfo
    }
  } catch (error) {
    console.error('[redis:getServerInfo] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get server info'
    }
  }
})
// Archive operations - create and download zip archive
ipcMain.handle('archive:createAndDownload', async (_event, options) => {
  const { filename, files } = options
  
  if (!mainWindow) {
    return {
      success: false,
      error: 'Window not available'
    }
  }

  try {
    // Use AdmZip to create the zip file
    const AdmZip = require('adm-zip')
    const zip = new AdmZip()
    
    // Add each file to the zip
    for (const file of files) {
      zip.addFile(file.name, Buffer.from(file.content, 'utf-8'))
    }
    
    // Get the zip buffer
    const zipBuffer = zip.toBuffer()
    
    // Create a temporary file path
    const tempDir = path.join(app.getPath('temp'), 'redis-desktop-exports')
    try {
      await fs.mkdir(tempDir, { recursive: true })
    } catch (e) {
      // Directory already exists or error
    }
    
    const tempFilePath = path.join(tempDir, filename)
    
    // Write the zip file
    await fs.writeFile(tempFilePath, zipBuffer)
    
    // Trigger download via BrowserWindow
    mainWindow.webContents.downloadURL(`file://${tempFilePath}`)
    
    return {
      success: true
    }
  } catch (error) {
    console.error('[archive:createAndDownload] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create archive'
    }
  }
})
