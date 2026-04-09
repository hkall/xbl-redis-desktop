import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  DbConnection,
  DatabaseType,
  QueryResult,
  QueryHistory,
  SavedQuery,
  DatabaseInfo,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  TableStructure,
  QueryTab,
  DATABASE_CONFIGS,
} from '@/types/database'

// 数据库状态
interface DbState {
  // 连接管理
  connections: DbConnection[]
  activeConnectionId: string | null
  activeDatabase: string | null

  // 当前选中的表/视图
  selectedTable: string | null
  selectedTableType: 'TABLE' | 'VIEW' | null

  // 元数据缓存
  databasesCache: Record<string, DatabaseInfo[]>  // connectionId -> databases
  tablesCache: Record<string, Record<string, TableInfo[]>>  // connectionId -> { database -> tables }
  columnsCache: Record<string, Record<string, Record<string, ColumnInfo[]>>>  // connectionId -> { database -> { table -> columns } }

  // 查询相关
  queryTabs: QueryTab[]
  activeTabId: string | null
  queryHistory: QueryHistory[]
  savedQueries: SavedQuery[]

  // 执行状态
  executing: boolean
  currentResult: QueryResult | null

  // UI状态
  sidebarWidth: number
  expandedNodes: Set<string>
}

// 数据库操作
interface DbActions {
  // 连接管理
  addConnection: (config: Omit<DbConnection, 'id' | 'connected' | 'connecting' | 'error' | 'createdAt' | 'updatedAt'>) => string
  updateConnection: (id: string, updates: Partial<DbConnection>) => void
  deleteConnection: (id: string) => void
  duplicateConnection: (id: string) => string | null
  setActiveConnection: (id: string | null) => void
  setActiveDatabase: (database: string | null) => void
  connect: (id: string) => Promise<boolean>
  disconnect: (id: string) => Promise<void>
  testConnection: (config: Partial<DbConnection>) => Promise<{ success: boolean; error?: string; serverVersion?: string }>

  // 表选择
  setSelectedTable: (table: string | null, type: 'TABLE' | 'VIEW' | null) => void

  // 元数据缓存
  cacheDatabases: (connectionId: string, databases: DatabaseInfo[]) => void
  cacheTables: (connectionId: string, database: string, tables: TableInfo[]) => void
  cacheColumns: (connectionId: string, database: string, table: string, columns: ColumnInfo[]) => void
  clearCache: (connectionId?: string) => void
  getCachedDatabases: (connectionId: string) => DatabaseInfo[] | undefined
  getCachedTables: (connectionId: string, database: string) => TableInfo[] | undefined
  getCachedColumns: (connectionId: string, database: string, table: string) => ColumnInfo[] | undefined

  // 查询标签页
  createQueryTab: (name?: string, sql?: string) => string
  closeQueryTab: (id: string) => void
  setActiveTab: (id: string | null) => void
  updateTabSql: (id: string, sql: string) => void
  updateTabName: (id: string, name: string) => void
  updateTabResult: (id: string, result: QueryResult) => void
  getActiveTab: () => QueryTab | null

  // 查询执行
  executeQuery: (sql: string, database?: string) => Promise<QueryResult>
  executeCurrentTab: () => Promise<QueryResult | null>

  // 历史管理
  addQueryHistory: (item: Omit<QueryHistory, 'id' | 'timestamp'>) => void
  clearQueryHistory: () => void
  getQueryHistory: (limit?: number) => QueryHistory[]

  // 收藏查询
  addSavedQuery: (name: string, sql: string, connectionId?: string, database?: string) => string
  updateSavedQuery: (id: string, updates: Partial<SavedQuery>) => void
  deleteSavedQuery: (id: string) => void

  // UI状态
  setSidebarWidth: (width: number) => void
  toggleNodeExpand: (nodeId: string) => void
  setNodeExpanded: (nodeId: string, expanded: boolean) => void

  // 持久化
  loadFromStorage: () => Promise<void>
}

// 生成唯一ID
const generateId = () => crypto.randomUUID()

// 默认连接配置
export const createDefaultConnection = (type: DatabaseType = 'mysql'): Omit<DbConnection, 'id' | 'connected' | 'connecting' | 'error' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  type,
  host: 'localhost',
  port: DATABASE_CONFIGS[type].defaultPort,
  username: type === 'sqlite' ? '' : 'root',
  password: '',
  database: '',
  charset: 'utf8mb4',
  ssl: false,
  connectTimeout: 30000,
})

export const useDbStore = create<DbState & DbActions>()(
  persist(
    (set, get) => ({
      // ============ 初始状态 ============
      connections: [],
      activeConnectionId: null,
      activeDatabase: null,
      selectedTable: null,
      selectedTableType: null,
      databasesCache: {},
      tablesCache: {},
      columnsCache: {},
      queryTabs: [],
      activeTabId: null,
      queryHistory: [],
      savedQueries: [],
      executing: false,
      currentResult: null,
      sidebarWidth: 280,
      expandedNodes: new Set(),

      // ============ 连接管理 ============
      addConnection: (config) => {
        const id = generateId()
        const now = Date.now()
        const connection: DbConnection = {
          ...config,
          id,
          connected: false,
          connecting: false,
          createdAt: now,
          updatedAt: now,
        }
        set((state) => ({
          connections: [...state.connections, connection],
        }))
        return id
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          ),
        }))
      },

      deleteConnection: (id) => {
        set((state) => {
          // 清理相关缓存
          const newDatabasesCache = { ...state.databasesCache }
          const newTablesCache = { ...state.tablesCache }
          const newColumnsCache = { ...state.columnsCache }
          delete newDatabasesCache[id]
          delete newTablesCache[id]
          delete newColumnsCache[id]

          return {
            connections: state.connections.filter((c) => c.id !== id),
            activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
            databasesCache: newDatabasesCache,
            tablesCache: newTablesCache,
            columnsCache: newColumnsCache,
          }
        })
      },

      duplicateConnection: (id) => {
        const connection = get().connections.find((c) => c.id === id)
        if (!connection) return null

        const newId = generateId()
        const newConnection: DbConnection = {
          ...connection,
          id: newId,
          name: `${connection.name} (copy)`,
          connected: false,
          connecting: false,
          error: undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          connections: [...state.connections, newConnection],
        }))
        return newId
      },

      setActiveConnection: (id) => {
        set({
          activeConnectionId: id,
          activeDatabase: null,
          selectedTable: null,
          selectedTableType: null,
        })
      },

      setActiveDatabase: (database) => {
        set({
          activeDatabase: database,
          selectedTable: null,
          selectedTableType: null,
        })
      },

      connect: async (id) => {
        const connection = get().connections.find((c) => c.id === id)
        if (!connection) return false

        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, connecting: true, error: undefined } : c
          ),
        }))

        try {
          if (!window.electronAPI?.dbCreateConnection) {
            throw new Error('Database API not available')
          }

          const result = await window.electronAPI.dbCreateConnection({
            name: connection.name,
            type: connection.type,
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.password,
            database: connection.database,
            charset: connection.charset,
            ssl: connection.ssl,
            connectTimeout: connection.connectTimeout,
          })

          if (result.success) {
            set((state) => ({
              connections: state.connections.map((c) =>
                c.id === id ? { ...c, connected: true, connecting: false, error: undefined } : c
              ),
              activeConnectionId: id,
            }))
            return true
          } else {
            set((state) => ({
              connections: state.connections.map((c) =>
                c.id === id ? { ...c, connected: false, connecting: false, error: result.error } : c
              ),
            }))
            return false
          }
        } catch (error) {
          set((state) => ({
            connections: state.connections.map((c) =>
              c.id === id ? {
                ...c,
                connected: false,
                connecting: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              } : c
            ),
          }))
          return false
        }
      },

      disconnect: async (id) => {
        try {
          if (window.electronAPI?.dbCloseConnection) {
            await window.electronAPI.dbCloseConnection(id)
          }
        } catch (error) {
          console.error('Disconnect error:', error)
        }

        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, connected: false, connecting: false } : c
          ),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
          activeDatabase: state.activeConnectionId === id ? null : state.activeDatabase,
          selectedTable: state.activeConnectionId === id ? null : state.selectedTable,
          selectedTableType: state.activeConnectionId === id ? null : state.selectedTableType,
        }))
      },

      testConnection: async (config) => {
        if (!window.electronAPI?.dbTestConnection) {
          return { success: false, error: 'Database API not available' }
        }

        try {
          const result = await window.electronAPI.dbTestConnection(config)
          return result
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },

      // ============ 表选择 ============
      setSelectedTable: (table, type) => {
        set({
          selectedTable: table,
          selectedTableType: type,
        })
      },

      // ============ 元数据缓存 ============
      cacheDatabases: (connectionId, databases) => {
        set((state) => ({
          databasesCache: {
            ...state.databasesCache,
            [connectionId]: databases,
          },
        }))
      },

      cacheTables: (connectionId, database, tables) => {
        set((state) => ({
          tablesCache: {
            ...state.tablesCache,
            [connectionId]: {
              ...(state.tablesCache[connectionId] || {}),
              [database]: tables,
            },
          },
        }))
      },

      cacheColumns: (connectionId, database, table, columns) => {
        set((state) => ({
          columnsCache: {
            ...state.columnsCache,
            [connectionId]: {
              ...(state.columnsCache[connectionId] || {}),
              [database]: {
                ...(state.columnsCache[connectionId]?.[database] || {}),
                [table]: columns,
              },
            },
          },
        }))
      },

      clearCache: (connectionId) => {
        set((state) => {
          if (connectionId) {
            const newDatabasesCache = { ...state.databasesCache }
            const newTablesCache = { ...state.tablesCache }
            const newColumnsCache = { ...state.columnsCache }
            delete newDatabasesCache[connectionId]
            delete newTablesCache[connectionId]
            delete newColumnsCache[connectionId]
            return {
              databasesCache: newDatabasesCache,
              tablesCache: newTablesCache,
              columnsCache: newColumnsCache,
            }
          }
          return {
            databasesCache: {},
            tablesCache: {},
            columnsCache: {},
          }
        })
      },

      getCachedDatabases: (connectionId) => {
        return get().databasesCache[connectionId]
      },

      getCachedTables: (connectionId, database) => {
        return get().tablesCache[connectionId]?.[database]
      },

      getCachedColumns: (connectionId, database, table) => {
        return get().columnsCache[connectionId]?.[database]?.[table]
      },

      // ============ 查询标签页 ============
      createQueryTab: (name, sql) => {
        const id = generateId()
        const tab: QueryTab = {
          id,
          name: name || `Query ${get().queryTabs.length + 1}`,
          sql: sql || '',
          isModified: false,
          createdAt: Date.now(),
        }
        set((state) => ({
          queryTabs: [...state.queryTabs, tab],
          activeTabId: id,
        }))
        return id
      },

      closeQueryTab: (id) => {
        set((state) => {
          const newTabs = state.queryTabs.filter((t) => t.id !== id)
          let newActiveTabId = state.activeTabId
          if (state.activeTabId === id) {
            newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
          }
          return {
            queryTabs: newTabs,
            activeTabId: newActiveTabId,
          }
        })
      },

      setActiveTab: (id) => {
        set({ activeTabId: id })
      },

      updateTabSql: (id, sql) => {
        set((state) => ({
          queryTabs: state.queryTabs.map((t) =>
            t.id === id ? { ...t, sql, isModified: true } : t
          ),
        }))
      },

      updateTabName: (id, name) => {
        set((state) => ({
          queryTabs: state.queryTabs.map((t) =>
            t.id === id ? { ...t, name } : t
          ),
        }))
      },

      updateTabResult: (id, result) => {
        set((state) => ({
          queryTabs: state.queryTabs.map((t) =>
            t.id === id ? { ...t, result, isModified: false } : t
          ),
          currentResult: result,
        }))
      },

      getActiveTab: () => {
        const state = get()
        return state.queryTabs.find((t) => t.id === state.activeTabId) || null
      },

      // ============ 查询执行 ============
      executeQuery: async (sql, database) => {
        const state = get()
        const connectionId = state.activeConnectionId

        if (!connectionId) {
          return {
            success: false,
            error: 'No active connection',
            executionTime: 0,
          }
        }

        if (!window.electronAPI?.dbExecuteQuery) {
          return {
            success: false,
            error: 'Database API not available',
            executionTime: 0,
          }
        }

        set({ executing: true })

        const startTime = Date.now()
        try {
          const result = await window.electronAPI.dbExecuteQuery(
            connectionId,
            sql,
            database || state.activeDatabase || undefined
          )

          // 添加到历史记录
          get().addQueryHistory({
            connectionId,
            database: database || state.activeDatabase || '',
            sql,
            executionTime: result.executionTime,
            rowCount: result.rowCount,
            error: result.error,
          })

          return result
        } catch (error) {
          const result: QueryResult = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            executionTime: Date.now() - startTime,
          }
          return result
        } finally {
          set({ executing: false })
        }
      },

      executeCurrentTab: async () => {
        const tab = get().getActiveTab()
        if (!tab || !tab.sql.trim()) return null

        const result = await get().executeQuery(tab.sql)
        get().updateTabResult(tab.id, result)
        return result
      },

      // ============ 历史管理 ============
      addQueryHistory: (item) => {
        const historyItem: QueryHistory = {
          ...item,
          id: generateId(),
          timestamp: Date.now(),
        }
        set((state) => ({
          queryHistory: [historyItem, ...state.queryHistory].slice(0, 500), // 保留最近500条
        }))
      },

      clearQueryHistory: () => {
        set({ queryHistory: [] })
      },

      getQueryHistory: (limit = 100) => {
        return get().queryHistory.slice(0, limit)
      },

      // ============ 收藏查询 ============
      addSavedQuery: (name, sql, connectionId, database) => {
        const id = generateId()
        const query: SavedQuery = {
          id,
          name,
          sql,
          connectionId,
          database,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        set((state) => ({
          savedQueries: [...state.savedQueries, query],
        }))
        return id
      },

      updateSavedQuery: (id, updates) => {
        set((state) => ({
          savedQueries: state.savedQueries.map((q) =>
            q.id === id ? { ...q, ...updates, updatedAt: Date.now() } : q
          ),
        }))
      },

      deleteSavedQuery: (id) => {
        set((state) => ({
          savedQueries: state.savedQueries.filter((q) => q.id !== id),
        }))
      },

      // ============ UI状态 ============
      setSidebarWidth: (width) => {
        set({ sidebarWidth: Math.max(200, Math.min(500, width)) })
      },

      toggleNodeExpand: (nodeId) => {
        set((state) => {
          const newExpanded = new Set(state.expandedNodes)
          if (newExpanded.has(nodeId)) {
            newExpanded.delete(nodeId)
          } else {
            newExpanded.add(nodeId)
          }
          return { expandedNodes: newExpanded }
        })
      },

      setNodeExpanded: (nodeId, expanded) => {
        set((state) => {
          const newExpanded = new Set(state.expandedNodes)
          if (expanded) {
            newExpanded.add(nodeId)
          } else {
            newExpanded.delete(nodeId)
          }
          return { expandedNodes: newExpanded }
        })
      },

      // ============ 持久化 ============
      loadFromStorage: async () => {
        // persist 中间件会自动处理
      },
    }),
    {
      name: 'xbl-db-storage',
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          ...c,
          connected: false, // 不持久化连接状态
          connecting: false,
          error: undefined,
        })),
        savedQueries: state.savedQueries,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
)