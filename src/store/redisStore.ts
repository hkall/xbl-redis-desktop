import { create } from 'zustand'

// Redis data types
export type RedisDataType = 'string' | 'hash' | 'list' | 'set' | 'zset'

// Connection configuration
export interface RedisConnectionConfig {
  id?: string // Make optional for config form
  name: string
  host: string
  port: number
  password: string
  database: number
  mode: 'standalone' | 'sentinel' | 'cluster'
}

// Connection state
export interface RedisConnection extends Omit<RedisConnectionConfig, 'id'> {
  id: string
  connected: boolean
  connecting: boolean
  error?: string
  databaseInfo: Record<number, number> // maps db index to key count
}

// Key information
export interface RedisKey {
  name: string
  type: RedisDataType
  ttl: number
  size: number
}

// Stored config (what gets saved to disk)
interface StoredConfig {
  connections: Omit<RedisConnectionConfig, 'id'>[]
  activeConnectionIndex: number | null
}

// Store state
interface RedisStore {
  // Connections
  connections: RedisConnection[]
  activeConnectionId: string | null

  // Keys
  keys: RedisKey[]
  keysLoading: boolean
  keysPattern: string
  keysTypeFilter: RedisDataType | 'all'
  totalKeys: number

  // Selected key
  selectedKey: string | null

  // Actions
  addConnection: (config: Omit<RedisConnectionConfig, 'id'>) => void
  removeConnection: (id: string) => void
  setActiveConnection: (id: string | null) => void
  updateConnectionStatus: (id: string, status: Partial<RedisConnection>) => void
  updateConnectionConfig: (id: string, config: Omit<RedisConnectionConfig, 'id'>) => void
  selectDatabase: (id: string, db: number) => void
  updateDatabaseInfo: (id: string, info: Record<number, number>) => void

  setKeys: (keys: RedisKey[]) => void
  setKeysLoading: (loading: boolean) => void
  setKeysPattern: (pattern: string) => void
  setKeysTypeFilter: (filter: RedisDataType | 'all') => void
  addKey: (key: RedisKey) => void
  removeKey: (key: string) => void
  updateKey: (key: string, data: Partial<RedisKey>) => void

  setSelectedKey: (key: string | null) => void

  // File-based persistence
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<void>
}

// Helper: Save config to file
async function saveConfigToFile(
  connections: RedisConnection[],
  activeConnectionId: string | null
): Promise<void> {
  if (window.electronAPI && window.electronAPI.saveConfig) {
    const activeIndex = activeConnectionId
      ? connections.findIndex((c) => c.id === activeConnectionId)
      : null

    const config: StoredConfig = {
      connections: connections.map((c) => ({
        name: c.name,
        host: c.host,
        port: c.port,
        password: c.password,
        database: c.database,
        mode: c.mode,
      })),
      activeConnectionIndex: activeIndex,
    }

    await window.electronAPI.saveConfig('connections', config)
  }
}

// Helper: Load config from file
async function loadConfigFromFile(): Promise<{
  connections: Omit<RedisConnectionConfig, 'id'>[]
  activeConnectionId: string | null
} | null> {
  if (window.electronAPI && window.electronAPI.loadConfig) {
    const result = await window.electronAPI.loadConfig('connections')

    if (result.success && result.data) {
      const config = result.data as StoredConfig

      // Reconstruct connections with IDs
      const connections = config.connections.map((c) => ({
        ...c,
        id: crypto.randomUUID(),
        connected: false,
        connecting: false,
      })) as RedisConnection[]

      // Get the active connection ID based on the saved index
      const activeConnectionId =
        config.activeConnectionIndex !== null && config.activeConnectionIndex >= 0
          ? connections[config.activeConnectionIndex]?.id || null
          : null

      return { connections, activeConnectionId }
    }
  }

  return {
    connections: [],
    activeConnectionId: null,
  }
}

export const useRedisStore = create<RedisStore>((set, get) => ({
  // Initial state
  connections: [],
  activeConnectionId: null,
  keys: [],
  keysLoading: false,
  keysPattern: '*',
  keysTypeFilter: 'all',
  totalKeys: 0,
  selectedKey: null,

  // Load config from file (call on app startup)
  loadConfig: async () => {
    try {
      const result = await loadConfigFromFile()
      if (result && result.connections && result.connections.length > 0) {
        const connections = result.connections.map((c) => ({
          ...c,
          id: crypto.randomUUID(),
          connected: false,
          connecting: false,
          databaseInfo: {},
        })) as RedisConnection[]
        set({
          connections,
          activeConnectionId: result.activeConnectionId,
        })
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  },

  // Save config to file (call on any connection config change)
  saveConfig: async () => {
    const { connections, activeConnectionId } = get()
    await saveConfigToFile(connections, activeConnectionId)
  },

  // Actions
  addConnection: (config) => {
    const newConnection = {
      ...config,
      id: crypto.randomUUID(),
      connected: false,
      connecting: false,
    } as RedisConnection

    set((state) => ({
      connections: [...state.connections, newConnection],
    }))

    // Auto-save
    get().saveConfig()
  },

  removeConnection: (id) => {
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      activeConnectionId:
        state.activeConnectionId === id ? null : state.activeConnectionId,
      keys: state.activeConnectionId === id ? [] : state.keys,
      selectedKey:
        state.activeConnectionId === id ? null : state.selectedKey,
    }))

    // Auto-save
    get().saveConfig()
  },

  setActiveConnection: (id) =>
    set({ activeConnectionId: id, keys: [], totalKeys: 0, selectedKey: null }),

  updateConnectionStatus: (id, status) =>
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, ...status } : c
      ),
    })),

  updateConnectionConfig: (id, config) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, ...config } : c
      ),
    }))

    // Auto-save
    get().saveConfig()
  },

  updateDatabaseInfo: (id, info) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === id ? { ...c, databaseInfo: info } : c
      ),
    }))
  },

  selectDatabase: (id, db) => {
    set((state) => {
      // Update connection's database without triggering config save
      const connections = state.connections.map((c) =>
        c.id === id ? { ...c, database: db } : c
      )
      return {
        connections,
        // Clear keys when switching database
        keys: [],
        selectedKey: null,
      }
    })
  },

  setKeys: (keys) => set({ keys }),

  setKeysLoading: (loading) => set({ keysLoading: loading }),

  setKeysPattern: (pattern) => set({ keysPattern: pattern }),

  setKeysTypeFilter: (filter) => set({ keysTypeFilter: filter }),

  addKey: (key) =>
    set((state) => ({
      keys: [...state.keys, key],
    })),

  removeKey: (keyName) =>
    set((state) => ({
      keys: state.keys.filter((k) => k.name !== keyName),
    })),

  updateKey: (keyName, data) =>
    set((state) => ({
      keys: state.keys.map((k) => (k.name === keyName ? { ...k, ...data } : k)),
    })),

  setSelectedKey: (key) => {
    set({ selectedKey: key })
  },
}))

// Electron API type declarations
declare global {
  interface Window {
    electronAPI: {
      saveConfig: (key: string, data: any) => Promise<{ success: boolean; error?: string }>
      loadConfig: (key: string) => Promise<{ success: boolean; data?: any; error?: string }>
      getUserDataPath: () => Promise<{ success: boolean; data?: string; error?: string }>
      redisTest: (config: any) => Promise<any>
      redisConnect: (id: string, config: any) => Promise<any>
      redisDisconnect: (id: string) => Promise<any>
      redisScan: (id: string, pattern?: string, count?: number) => Promise<any>
      redisKeyInfo: (id: string, key: string) => Promise<any>
      redisGet: (id: string, key: string) => Promise<any>
      redisSet: (id: string, key: string, type: string, value: any) => Promise<any>
      redisDelete: (id: string, key: string) => Promise<any>
      redisRename: (id: string, key: string, newKey: string) => Promise<any>
      redisSetTTL: (id: string, key: string, seconds: number) => Promise<any>
      redisClearTTL: (id: string, key: string) => Promise<any>
      redisInfo: (id: string) => Promise<any>
      redisSelectDb: (id: string, db: number) => Promise<any>
      javaDeserialize: (byteArray: number[]) => Promise<any>
    }
  }
}