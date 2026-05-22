import React, { useState, useEffect } from 'react'
import {
  Database,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Table,
  Eye,
  FileCode,
  Zap,
  Trash2,
  Edit2,
  Copy,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Star,
  FolderOpen,
  Bolt,
  FileText,
  Clipboard,
  Terminal,
} from 'lucide-react'
import { useDbStore, createDefaultConnection } from '@/store/dbStore'
import { useTranslation } from '@/store/i18nStore'
import {
  DbConnection,
  DatabaseType,
  DATABASE_CONFIGS,
} from '@/types/database'
import ConfirmDialog from '../ConfirmDialog'

// 数据库类型图标颜色
const DB_COLORS: Record<DatabaseType, string> = {
  mysql: '#4479A1',
  mariadb: '#003B5C',
  postgresql: '#336791',
  sqlite: '#003B57',
}

// 连接对话框
function ConnectionDialog({
  isOpen,
  connection,
  onSave,
  onCancel,
}: {
  isOpen: boolean
  connection: DbConnection | null
  onSave: (config: Omit<DbConnection, 'id' | 'connected' | 'connecting' | 'error' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<Omit<DbConnection, 'id' | 'connected' | 'connecting' | 'error' | 'createdAt' | 'updatedAt'>>(
    connection || createDefaultConnection('mysql')
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(connection || createDefaultConnection('mysql'))
      setTestResult(null)
    }
  }, [isOpen, connection])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await useDbStore.getState().testConnection(form)
      setTestResult({
        success: result.success,
        message: result.success
          ? `${t('database.connectionSuccess')}${result.serverVersion ? ` (${result.serverVersion})` : ''}`
          : result.error || t('database.connectionFailed'),
      })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('database.connectionFailed'),
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      return
    }
    onSave(form)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-800 rounded-md shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">
            {connection ? t('database.editConnection') : t('database.newConnection')}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* 连接名称 */}
          <div>
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('database.connectionName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('database.connectionName')}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
            />
          </div>

          {/* 数据库类型 */}
          <div>
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('database.dbType')}
            </label>
            <select
              value={form.type}
              onChange={(e) => {
                const type = e.target.value as DatabaseType
                setForm({
                  ...form,
                  type,
                  port: DATABASE_CONFIGS[type].defaultPort,
                })
              }}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
            >
              {Object.entries(DATABASE_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          {/* 主机和端口 */}
          {form.type !== 'sqlite' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.host')}
                </label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder={t('database.hostPlaceholderDb')}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.port')}
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
                />
              </div>
            </div>
          )}

          {/* 用户名和密码 */}
          {form.type !== 'sqlite' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.username')}
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.password')}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
                />
              </div>
            </div>
          )}

          {/* 默认数据库 */}
          <div>
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('database.defaultDatabase')} <span className="text-gray-400">({t('common.none')})</span>
            </label>
            <input
              type="text"
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
            />
          </div>

          {/* 字符集 */}
          {form.type !== 'sqlite' && (
            <div>
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Charset
              </label>
              <select
                value={form.charset || 'utf8mb4'}
                onChange={(e) => setForm({ ...form, charset: e.target.value })}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[13px]"
              >
                <option value="utf8mb4">utf8mb4 ({t('database.charsetRecommended')})</option>
                <option value="utf8">utf8</option>
                <option value="gbk">gbk</option>
                <option value="gb2312">gb2312</option>
                <option value="gb18030">gb18030</option>
                <option value="big5">big5</option>
                <option value="latin1">latin1</option>
              </select>
            </div>
          )}

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-1.5 p-3 rounded-md text-[13px] ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleTest}
            disabled={testing || !form.host}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {t('database.testConnection')}
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 连接项组件
function ConnectionItem({
  connection,
  isActive,
  onConnect,
  onDisconnect,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
  expanded,
  onToggle,
  onContextMenu,
}: {
  connection: DbConnection
  isActive: boolean
  onConnect: () => void
  onDisconnect: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onSelect: () => void
  expanded?: boolean
  onToggle?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = useState(false)

  const statusColor = connection.connected
    ? 'bg-green-500'
    : connection.connecting
    ? 'bg-yellow-500'
    : connection.error
    ? 'bg-red-500'
    : 'bg-gray-400'

  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
    >
      {/* 展开/折叠按钮（仅已连接时显示） */}
      {connection.connected && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {expanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </button>
      )}

      {/* 状态指示器 */}
      <div className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} />

      {/* 数据库图标 */}
      <Database
        className="w-3.5 h-3.5 flex-shrink-0"
        style={{ color: DB_COLORS[connection.type] }}
      />

      {/* 连接名称 */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 dark:text-white truncate">
          {connection.name}
        </div>
        <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
          {connection.host}:{connection.port}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {connection.connected ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDisconnect()
            }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            title={t('redis.disconnect')}
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onConnect()
            }}
            disabled={connection.connecting}
            className="p-1 text-gray-400 hover:text-green-500 transition-colors disabled:opacity-50"
            title={t('redis.connect')}
          >
            {connection.connecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 z-20 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onEdit()
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {t('common.edit')}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDuplicate()
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {t('common.copy')}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete()
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('common.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DbSidebar() {
  const { t } = useTranslation()
  const {
    connections,
    activeConnectionId,
    activeDatabase,
    savedQueries,
    expandedNodes,
    addConnection,
    updateConnection,
    deleteConnection,
    duplicateConnection,
    setActiveConnection,
    setActiveDatabase,
    openTableTab,
    openProcedureTab,
    openTriggerTab,
    connect,
    disconnect,
    getCachedDatabases,
    getCachedTables,
    cacheDatabases,
    cacheTables,
    toggleNodeExpand,
    createQueryTab,
    deleteSavedQuery,
  } = useDbStore()

  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DbConnection | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  })
  const [dropTableConfirm, setDropTableConfirm] = useState<{ isOpen: boolean; connectionId: string; database: string; tableName: string }>({
    isOpen: false,
    connectionId: '',
    database: '',
    tableName: '',
  })
  const [loadingDatabases, setLoadingDatabases] = useState<string | null>(null)
  const [loadingTables, setLoadingTables] = useState<string | null>(null)
  const [proceduresCache, setProceduresCache] = useState<Record<string, Record<string, any[]>>>({})
  const [triggersCache, setTriggersCache] = useState<Record<string, Record<string, any[]>>>({})
  const [loadedDatabases, setLoadedDatabases] = useState<Set<string>>(new Set())
  const [tableSearchText, setTableSearchText] = useState<Record<string, string>>({}) // 每个数据库的表搜索文本
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'connection' | 'database' | 'table' | 'view' | 'procedure' | 'trigger'
    connectionId: string
    database?: string
    itemName?: string
  } | null>(null)

  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // 分类展开状态 - 使用 expandedNodes 存储
  const isCategoryExpanded = (categoryKey: string) => expandedNodes.includes(categoryKey)
  const toggleCategory = (categoryKey: string) => toggleNodeExpand(categoryKey)

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent, type: 'connection' | 'database' | 'table' | 'view' | 'procedure' | 'trigger', connectionId: string, database?: string, itemName?: string) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 300)
    setContextMenu({ x, y, type, connectionId, database, itemName })
  }

  const closeContextMenu = () => setContextMenu(null)

  // 生成 SQL
  const generateSelectSql = (tableName: string) => {
    const sql = `SELECT * FROM \`${tableName}\` LIMIT 100;`
    createQueryTab(`${tableName} - SELECT`, sql)
    closeContextMenu()
  }

  const generateInsertSql = (tableName: string) => {
    const sql = `INSERT INTO \`${tableName}\` (\n  -- columns\n) VALUES (\n  -- values\n);`
    createQueryTab(`${tableName} - INSERT`, sql)
    closeContextMenu()
  }

  const generateUpdateSql = (tableName: string) => {
    const sql = `UPDATE \`${tableName}\` SET\n  -- column = value\nWHERE -- condition;`
    createQueryTab(`${tableName} - UPDATE`, sql)
    closeContextMenu()
  }

  const generateDeleteSql = (tableName: string) => {
    const sql = `DELETE FROM \`${tableName}\` WHERE -- condition;`
    createQueryTab(`${tableName} - DELETE`, sql)
    closeContextMenu()
  }

  // 复制表名
  const copyTableName = (tableName: string) => {
    navigator.clipboard.writeText(tableName)
    closeContextMenu()
  }

  // 刷新表列表
  const refreshTableList = async (connectionId: string, database: string) => {
    await loadTables(connectionId, database)
    closeContextMenu()
  }

  // 刷新数据库列表
  const refreshDatabaseList = async (connectionId: string) => {
    await loadDatabases(connectionId)
    closeContextMenu()
  }

  // 为表新建查询
  const newQueryForTable = (_connectionId: string, database: string, tableName: string) => {
    setActiveDatabase(database)
    const sql = `SELECT * FROM \`${tableName}\` LIMIT 100;`
    createQueryTab(`Query - ${tableName}`, sql)
    closeContextMenu()
  }

  // 生成CREATE TABLE语句
  const generateCreateTableSql = async (connectionId: string, database: string, tableName: string) => {
    setActiveDatabase(database)
    try {
      const result = await window.electronAPI?.dbGetTableStructure?.(connectionId, database, tableName)
      if (result?.success && result.createStatement) {
        createQueryTab(`${tableName} - DDL`, result.createStatement)
      } else {
        createQueryTab(`${tableName} - DDL`, `-- Failed to get CREATE TABLE for ${tableName}`)
      }
    } catch {
      createQueryTab(`${tableName} - DDL`, `-- Error getting CREATE TABLE for ${tableName}`)
    }
    closeContextMenu()
  }

  // 删除表 - 显示确认弹窗
  const dropTable = (connectionId: string, database: string, tableName: string) => {
    setDropTableConfirm({
      isOpen: true,
      connectionId,
      database,
      tableName,
    })
    closeContextMenu()
  }

  // 确认删除表
  const handleDropTable = async () => {
    const { connectionId, database, tableName } = dropTableConfirm
    setActiveDatabase(database)
    const sql = `DROP TABLE \`${tableName}\`;`
    if (window.electronAPI?.dbExecuteQuery) {
      const result = await window.electronAPI.dbExecuteQuery(connectionId, sql, database)
      if (result?.success) {
        loadTables(connectionId, database)
      } else {
        alert(result?.error || t('common.error'))
      }
    }
    setDropTableConfirm({ isOpen: false, connectionId: '', database: '', tableName: '' })
  }

  // 新建表
  const newTableForDatabase = (_connectionId: string, database: string) => {
    setActiveDatabase(database)
    const sql = `CREATE TABLE \`new_table\` (\n  \`id\` INT NOT NULL AUTO_INCREMENT,\n  \`name\` VARCHAR(255) NOT NULL,\n  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  PRIMARY KEY (\`id\`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    createQueryTab('New Table', sql)
    closeContextMenu()
  }

  // 默认展开所有分类
  useEffect(() => {
    if (activeConnectionId && activeConnection?.connected) {
      const nodeKey = `conn:${activeConnectionId}`
      if (!expandedNodes.includes(nodeKey)) {
        toggleNodeExpand(nodeKey)
        loadDatabases(activeConnectionId)
      }
    }
  }, [activeConnectionId, activeConnection?.connected])

  // 加载数据库列表
  const loadDatabases = async (connectionId: string) => {
    // 总是重新加载，不使用缓存
    setLoadingDatabases(connectionId)
    try {
      if (window.electronAPI?.dbGetDatabases) {
        const result = await window.electronAPI.dbGetDatabases(connectionId)
        if (result.success && result.databases) {
          cacheDatabases(connectionId, result.databases)
        }
      }
    } finally {
      setLoadingDatabases(null)
    }
  }

  // 加载表列表（包括存储过程和触发器）
  const loadTables = async (connectionId: string, database: string) => {
    const cacheKey = `${connectionId}:${database}`
    setLoadingTables(cacheKey)
    try {
      // 加载表和视图
      if (window.electronAPI?.dbGetTables) {
        const result = await window.electronAPI.dbGetTables(connectionId, database)
        if (result.success && result.tables) {
          cacheTables(connectionId, database, result.tables)
          // 默认展开"表"分类
          const tablesKey = `tables:${connectionId}:${database}`
          if (!expandedNodes.includes(tablesKey)) {
            toggleNodeExpand(tablesKey)
          }
        }
      }

      // 加载存储过程
      if (window.electronAPI?.dbGetProcedures) {
        const procResult = await window.electronAPI.dbGetProcedures(connectionId, database)
        if (procResult.success && procResult.procedures) {
          setProceduresCache(prev => ({
            ...prev,
            [connectionId]: {
              ...((prev[connectionId] as Record<string, any[]>) || {}),
              [database]: procResult.procedures || []
            }
          }))
        }
      }

      // 加载触发器
      if (window.electronAPI?.dbGetTriggers) {
        const triggerResult = await window.electronAPI.dbGetTriggers(connectionId, database)
        if (triggerResult.success && triggerResult.triggers) {
          setTriggersCache(prev => ({
            ...prev,
            [connectionId]: {
              ...((prev[connectionId] as Record<string, any[]>) || {}),
              [database]: triggerResult.triggers || []
            }
          }))
        }
      }

      // 标记已加载
      setLoadedDatabases(prev => new Set(prev).add(cacheKey))
    } finally {
      setLoadingTables(null)
    }
  }

  // 检查是否已加载某个数据库的详情
  const isDatabaseLoaded = (connectionId: string, database: string) => {
    return loadedDatabases.has(`${connectionId}:${database}`)
  }

  // 处理保存连接
  const handleSaveConnection = (config: Omit<DbConnection, 'id' | 'connected' | 'connecting' | 'error' | 'createdAt' | 'updatedAt'>) => {
    if (editingConnection) {
      updateConnection(editingConnection.id, config)
    } else {
      addConnection(config)
    }
    setShowConnectionDialog(false)
    setEditingConnection(null)
  }

  // 处理删除连接
  const handleDeleteConnection = async () => {
    const connection = connections.find((c) => c.id === deleteConfirm.id)
    if (connection?.connected) {
      await disconnect(deleteConfirm.id)
    }
    deleteConnection(deleteConfirm.id)
    setDeleteConfirm({ isOpen: false, id: '', name: '' })
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 px-3 h-9 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">{t('database.databases')}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2">
          <button
            onClick={() => createQueryTab('New Query', '')}
            className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
            title={t('database.newQuery')}
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setEditingConnection(null)
              setShowConnectionDialog(true)
            }}
            className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
            title={t('database.newConnection')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 连接列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">{t('database.noConnections')}</p>
            <button
              onClick={() => {
                setEditingConnection(null)
                setShowConnectionDialog(true)
              }}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-medium rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('database.newConnection')}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {connections.map((connection) => {
              const isConnectionExpanded = expandedNodes.includes(`conn:${connection.id}`)
              const databases = getCachedDatabases(connection.id) || []
              const isLoadingDatabases = loadingDatabases === connection.id

              return (
                <div key={connection.id}>
                  {/* 连接项 */}
                  <ConnectionItem
                    connection={connection}
                    isActive={activeConnectionId === connection.id}
                    expanded={isConnectionExpanded}
                    onConnect={() => connect(connection.id)}
                    onDisconnect={() => disconnect(connection.id)}
                    onEdit={() => {
                      setEditingConnection(connection)
                      setShowConnectionDialog(true)
                    }}
                    onDelete={() => setDeleteConfirm({ isOpen: true, id: connection.id, name: connection.name })}
                    onDuplicate={() => duplicateConnection(connection.id)}
                    onSelect={() => setActiveConnection(connection.id)}
                    onToggle={() => {
                      toggleNodeExpand(`conn:${connection.id}`)
                      if (connection.connected && !databases.length) {
                        loadDatabases(connection.id)
                      }
                    }}
                    onContextMenu={(e) => handleContextMenu(e, 'connection', connection.id)}
                  />

                  {/* 已连接且展开时显示数据库树 */}
                  {connection.connected && isConnectionExpanded && (
                    <div className="ml-4 mt-1 border-l border-gray-200 dark:border-gray-700 pl-2">
                      {/* 加载中 */}
                      {isLoadingDatabases && (
                        <div className="flex items-center gap-1.5 py-1.5 px-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                          <span className="text-[11px] text-gray-500">{t('common.loading')}</span>
                        </div>
                      )}

                      {/* 数据库列表 */}
                      {!isLoadingDatabases && databases.length > 0 && databases.map((db) => {
                        const isDbExpanded = expandedNodes.includes(`db:${connection.id}:${db.name}`)
                        const dbLoaded = isDatabaseLoaded(connection.id, db.name)
                        const tables = dbLoaded ? (getCachedTables(connection.id, db.name) || []) : []
                        const procedures = dbLoaded ? (proceduresCache[connection.id]?.[db.name] || []) : []
                        const triggers = dbLoaded ? (triggersCache[connection.id]?.[db.name] || []) : []
                        const isLoadingThisDb = loadingTables === `${connection.id}:${db.name}`

                        const dbTables = tables.filter((t) => t.type === 'TABLE')
                        const dbViews = tables.filter((t) => t.type === 'VIEW')

                        return (
                          <div key={db.name} className="mt-1">
                            {/* 数据库节点 */}
                            <div
                              className="flex items-center gap-1 px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer group"
                              onClick={() => {
                                const willExpand = !isDbExpanded
                                toggleNodeExpand(`db:${connection.id}:${db.name}`)
                                if (willExpand && !dbLoaded && !isLoadingThisDb) {
                                  loadTables(connection.id, db.name)
                                }
                              }}
                              onContextMenu={(e) => handleContextMenu(e, 'database', connection.id, db.name)}
                            >
                              {isLoadingThisDb ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 flex-shrink-0" />
                              ) : isDbExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              )}
                              <FolderOpen className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                              <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate font-medium">{db.name}</span>
                              {db.tableCount > 0 && (
                                <span className="text-[11px] text-gray-400 flex-shrink-0 ml-auto">{db.tableCount}</span>
                              )}
                            </div>

                            {/* 数据库内容 - 展开时显示 */}
                            {isDbExpanded && (
                              <div className="ml-2 pl-2 border-l border-gray-200 dark:border-gray-700">
                                {/* 加载中 */}
                                {isLoadingThisDb && !dbLoaded && (
                                  <div className="flex items-center gap-1.5 py-1.5 px-2">
                                    <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                                    <span className="text-[11px] text-gray-500">{t('common.loading')}</span>
                                  </div>
                                )}

                                {/* 表 - 始终显示分类，支持折叠 */}
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                  onClick={() => toggleCategory(`tables:${connection.id}:${db.name}`)}
                                >
                                  {isCategoryExpanded(`tables:${connection.id}:${db.name}`) ? (
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  )}
                                  <Table className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{t('database.tables')}</span>
                                  <span className="text-gray-400 flex-shrink-0">({dbTables.length})</span>
                                </div>
                                {isCategoryExpanded(`tables:${connection.id}:${db.name}`) && (
                                  <div className="ml-3 pl-2 border-l border-gray-100 dark:border-gray-700">
                                {/* 搜索框 */}
                                {dbTables.length > 10 && (
                                  <div className="px-1 py-1">
                                    <input
                                      type="text"
                                      placeholder={t('common.search')}
                                      value={tableSearchText[`${connection.id}:${db.name}`] || ''}
                                      onChange={(e) => setTableSearchText(prev => ({
                                        ...prev,
                                        [`${connection.id}:${db.name}`]: e.target.value
                                      }))}
                                      className="w-full px-1.5 py-0.5 text-[11px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-sm focus:outline-none focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                                {isLoadingThisDb && !dbLoaded ? (
                                  <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.loading')}</div>
                                ) : dbTables.length > 0 ? (
                                  (() => {
                                    const searchText = (tableSearchText[`${connection.id}:${db.name}`] || '').toLowerCase()
                                    const filteredTables = searchText
                                      ? dbTables.filter(t => t.name.toLowerCase().includes(searchText))
                                      : dbTables
                                    return filteredTables.length > 0 ? filteredTables.map((table) => (
                                      <div
                                        key={table.name}
                                        className={`flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer ${
                                          activeDatabase === db.name
                                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setActiveDatabase(db.name)
                                        openTableTab(connection.id, db.name, table.name, 'TABLE')
                                      }}
                                      onContextMenu={(e) => handleContextMenu(e, 'table', connection.id, db.name, table.name)}
                                    >
                                      <Table className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                      <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate">{table.name}</span>
                                      {table.rowCount !== undefined && table.rowCount > 0 && (
                                        <span className="text-[11px] text-gray-400 flex-shrink-0 ml-auto">{table.rowCount.toLocaleString()}</span>
                                      )}
                                    </div>
                                    )) : <div className="px-1.5 py-0.5 text-[11px] text-gray-400 dark:text-gray-500">{t('database.noMatchingResults')}</div>
                                  })()
                                ) : (
                                  !isLoadingThisDb && <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.none')}</div>
                                )}
                                  </div>
                                )}

                                {/* 视图 - 支持折叠 */}
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                  onClick={() => toggleCategory(`views:${connection.id}:${db.name}`)}
                                >
                                  {isCategoryExpanded(`views:${connection.id}:${db.name}`) ? (
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  )}
                                  <Eye className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{t('database.views')}</span>
                                  <span className="text-gray-400 flex-shrink-0">({dbViews.length})</span>
                                </div>
                                {isCategoryExpanded(`views:${connection.id}:${db.name}`) && (
                                  <div className="ml-3 pl-2 border-l border-gray-100 dark:border-gray-700">
                                {isLoadingThisDb && !dbLoaded ? (
                                  <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.loading')}</div>
                                ) : dbViews.length > 0 ? (
                                  dbViews.map((view) => (
                                    <div
                                      key={view.name}
                                      className={`flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer ${
                                        activeDatabase === db.name
                                          ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setActiveDatabase(db.name)
                                        openTableTab(connection.id, db.name, view.name, 'VIEW')
                                      }}
                                      onContextMenu={(e) => handleContextMenu(e, 'view', connection.id, db.name, view.name)}
                                    >
                                      <Eye className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                                      <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate">{view.name}</span>
                                    </div>
                                  ))
                                ) : (
                                  !isLoadingThisDb && <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.none')}</div>
                                )}
                                  </div>
                                )}

                                {/* 存储过程 - 支持折叠 */}
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                  onClick={() => toggleCategory(`procedures:${connection.id}:${db.name}`)}
                                >
                                  {isCategoryExpanded(`procedures:${connection.id}:${db.name}`) ? (
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  )}
                                  <FileCode className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{t('database.procedures')}</span>
                                  <span className="text-gray-400 flex-shrink-0">({procedures.length})</span>
                                </div>
                                {isCategoryExpanded(`procedures:${connection.id}:${db.name}`) && (
                                  <div className="ml-3 pl-2 border-l border-gray-100 dark:border-gray-700">
                                {isLoadingThisDb && !dbLoaded ? (
                                  <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.loading')}</div>
                                ) : procedures.length > 0 ? (
                                  procedures.map((proc) => (
                                    <div
                                      key={proc.name}
                                      className={`flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer ${
                                        activeDatabase === db.name
                                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setActiveDatabase(db.name)
                                        openProcedureTab(connection.id, db.name, proc.name)
                                      }}
                                    >
                                      <FileCode className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                      <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate">{proc.name}</span>
                                    </div>
                                  ))
                                ) : (
                                  !isLoadingThisDb && <div className="px-3 py-0.5 text-[11px] text-gray-400">{t('common.none')}</div>
                                )}
                                  </div>
                                )}

                                {/* 触发器 - 支持折叠 */}
                                <div
                                  className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm"
                                  onClick={() => toggleCategory(`triggers:${connection.id}:${db.name}`)}
                                >
                                  {isCategoryExpanded(`triggers:${connection.id}:${db.name}`) ? (
                                    <ChevronDown className="w-3 h-3 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                  )}
                                  <Bolt className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{t('database.triggers')}</span>
                                  <span className="text-gray-400 flex-shrink-0">({triggers.length})</span>
                                </div>
                                {isCategoryExpanded(`triggers:${connection.id}:${db.name}`) && (
                                  <div className="ml-3 pl-2 border-l border-gray-100 dark:border-gray-700">
                                {isLoadingThisDb && !dbLoaded ? (
                                  <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.loading')}</div>
                                ) : triggers.length > 0 ? (
                                  triggers.map((trigger) => (
                                    <div
                                      key={trigger.name}
                                      className={`flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer ${
                                        activeDatabase === db.name
                                          ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                          : ''
                                      }`}
                                      onClick={() => {
                                        setActiveDatabase(db.name)
                                        openTriggerTab(connection.id, db.name, trigger.name)
                                      }}
                                    >
                                      <Bolt className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" />
                                      <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate">{trigger.name}</span>
                                      <span className="text-[11px] text-gray-400 flex-shrink-0 ml-auto">{trigger.timing} {trigger.event}</span>
                                    </div>
                                  ))
                                ) : (
                                  !isLoadingThisDb && <div className="px-1.5 py-0.5 text-[11px] text-gray-400">{t('common.none')}</div>
                                )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 收藏查询 */}
        {savedQueries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 px-1.5 mb-2">
              <Star className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{t('database.savedQueries')}</span>
            </div>
            <div className="space-y-1">
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className="flex items-center gap-1.5 px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm cursor-pointer"
                  onClick={() => {
                    createQueryTab(query.name, query.sql)
                  }}
                >
                  <FileCode className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[13px] text-gray-700 dark:text-gray-300 truncate flex-1">
                    {query.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSavedQuery(query.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 连接对话框 */}
      <ConnectionDialog
        isOpen={showConnectionDialog}
        connection={editingConnection}
        onSave={handleSaveConnection}
        onCancel={() => {
          setShowConnectionDialog(false)
          setEditingConnection(null)
        }}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={t('database.deleteConnection')}
        message={t('database.deleteConnectionConfirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleDeleteConnection}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
      />

      {/* 删除表确认 */}
      <ConfirmDialog
        isOpen={dropTableConfirm.isOpen}
        title={t('database.dropTable')}
        message={t('database.dropTableConfirm', { name: dropTableConfirm.tableName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleDropTable}
        onCancel={() => setDropTableConfirm({ isOpen: false, connectionId: '', database: '', tableName: '' })}
      />

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {/* 表节点右键菜单 */}
            {contextMenu.type === 'table' && (
              <>
                <button
                  onClick={() => { setActiveDatabase(contextMenu.database!); openTableTab(contextMenu.connectionId, contextMenu.database!, contextMenu.itemName!, 'TABLE'); closeContextMenu() }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Table className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                  {t('database.openData')}
                </button>
                <button
                  onClick={() => newQueryForTable(contextMenu.connectionId, contextMenu.database!, contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Terminal className="w-3.5 h-3.5 text-green-500" />
                  {t('database.newQueryForTable')}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                <button
                  onClick={() => generateSelectSql(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.generateSelectSql')}
                </button>
                <button
                  onClick={() => generateInsertSql(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.generateInsertSql')}
                </button>
                <button
                  onClick={() => generateUpdateSql(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.generateUpdateSql')}
                </button>
                <button
                  onClick={() => generateDeleteSql(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.generateDeleteSql')}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                <button
                  onClick={() => generateCreateTableSql(contextMenu.connectionId, contextMenu.database!, contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.openStructure')}
                </button>
                <button
                  onClick={() => dropTable(contextMenu.connectionId, contextMenu.database!, contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t('database.dropTable')}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                <button
                  onClick={() => copyTableName(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Clipboard className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.copyTableName')}
                </button>
              </>
            )}

            {/* 视图节点右键菜单 */}
            {contextMenu.type === 'view' && (
              <>
                <button
                  onClick={() => { setActiveDatabase(contextMenu.database!); openTableTab(contextMenu.connectionId, contextMenu.database!, contextMenu.itemName!, 'VIEW'); closeContextMenu() }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Eye className="w-3.5 h-3.5 text-purple-500" />
                  {t('database.openData')}
                </button>
                <button
                  onClick={() => generateSelectSql(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.generateSelectSql')}
                </button>
                <button
                  onClick={() => copyTableName(contextMenu.itemName!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Clipboard className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.copyTableName')}
                </button>
              </>
            )}

            {/* 数据库节点右键菜单 */}
            {contextMenu.type === 'database' && (
              <>
                <button
                  onClick={() => refreshTableList(contextMenu.connectionId, contextMenu.database!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.refreshTableList')}
                </button>
                <button
                  onClick={() => { createQueryTab(`Query - ${contextMenu.database}`, ''); closeContextMenu() }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Terminal className="w-3.5 h-3.5 text-green-500" />
                  {t('database.newQuery')}
                </button>
                <button
                  onClick={() => newTableForDatabase(contextMenu.connectionId, contextMenu.database!)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-500" />
                  {t('database.newTable')}
                </button>
              </>
            )}

            {/* 连接节点右键菜单 */}
            {contextMenu.type === 'connection' && (
              <>
                <button
                  onClick={() => { createQueryTab('New Query', ''); closeContextMenu() }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Terminal className="w-3.5 h-3.5 text-green-500" />
                  {t('database.newQuery')}
                </button>
                <button
                  onClick={() => refreshDatabaseList(contextMenu.connectionId)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  {t('database.refreshConnection')}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                <button
                  onClick={() => disconnect(contextMenu.connectionId)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {t('database.disconnect')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}