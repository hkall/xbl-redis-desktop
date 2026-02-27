const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const Redis = require('ioredis')

let mainWindow = null

// Store active Redis connections
const redisConnections = new Map()

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'xbl Redis Desktop',
  })

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    // In production, load from built file
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

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

// Cleanup connections on quit
app.on('before-quit', () => {
  for (const [id, client] of redisConnections.entries()) {
    client.quit().catch(console.error)
  }
  redisConnections.clear()
})

// IPC Handlers

// Test Redis connection
ipcMain.handle('redis:test', async (_event, config) => {
  try {
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: 5000,
      lazyConnect: true,
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

// Connect to Redis
ipcMain.handle('redis:connect', async (_event, id, config) => {
  try {
    const client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      lazyConnect: true,
    })

    await client.connect()

    redisConnections.set(id, client)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
})

// Disconnect from Redis
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

// SCAN keys
ipcMain.handle('redis:scan', async (_event, id, pattern = '*', count = 100) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const keys = []
    let cursor = '0'

    do {
      const [nextCursor, batch] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', count)
      keys.push(...batch)
      cursor = nextCursor
    } while (cursor !== '0')

    return { success: true, data: keys }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scan keys',
    }
  }
})

// Get key info (type, ttl, size)
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
      case 'string':
        size = (await client.get(key))?.length || 0
        break
      case 'hash':
        size = await client.hlen(key)
        break
      case 'list':
        size = await client.llen(key)
        break
      case 'set':
        size = await client.scard(key)
        break
      case 'zset':
        size = await client.zcard(key)
        break
    }

    if (type === 'none') {
      return { success: false, error: 'Key does not exist' }
    }

    return {
      success: true,
      data: {
        name: key,
        type,
        ttl,
        size,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get key info',
    }
  }
})

// Get key value based on type
ipcMain.handle('redis:get', async (_event, id, key) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    const type = await client.type(key)

    switch (type) {
      case 'string':
        return { success: true, data: await client.get(key) }

      case 'hash':
        return { success: true, data: await client.hgetall(key) }

      case 'list':
        return { success: true, data: await client.lrange(key, 0, -1) }

      case 'set':
        return { success: true, data: await client.smembers(key) }

      case 'zset':
        const members = await client.zrange(key, 0, -1, 'WITHSCORES')
        const result = []
        for (let i = 0; i < members.length; i += 2) {
          result.push({ member: members[i], score: parseFloat(members[i + 1]) })
        }
        return { success: true, data: result }

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

// Set key value based on type
ipcMain.handle('redis:set', async (_event, id, key, type, value) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    switch (type) {
      case 'string':
        await client.set(key, value)
        break

      case 'hash':
        await client.hset(key, value.field, value.value)
        break

      case 'list':
        if (value.action === 'push') {
          if (value.direction === 'left') {
            await client.lpush(key, value.value)
          } else {
            await client.rpush(key, value.value)
          }
        } else if (value.action === 'set') {
          await client.lset(key, value.index, value.value)
        } else if (value.action === 'remove') {
          await client.lrem(key, 0, value.value)
        }
        break

      case 'set':
        if (value.action === 'add') {
          await client.sadd(key, value.member)
        } else if (value.action === 'remove') {
          await client.srem(key, value.member)
        }
        break

      case 'zset':
        if (value.action === 'add') {
          await client.zadd(key, value.score, value.member)
        } else if (value.action === 'update') {
          await client.zadd(key, value.score, value.member)
        } else if (value.action === 'remove') {
          await client.zrem(key, value.member)
        }
        break

      default:
        throw new Error(`Unsupported data type: ${type}`)
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set value',
    }
  }
})

// Delete key
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

// Rename key
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

// Set TTL
ipcMain.handle('redis:setTTL', async (_event, id, key, seconds) => {
  try {
    const client = redisConnections.get(id)
    if (!client) {
      throw new Error('Not connected to Redis')
    }

    await client.expire(key, seconds)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set TTL',
    }
  }
})

// Clear TTL
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

// Database info
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