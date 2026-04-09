import React, { useState, useEffect } from 'react'
import {
  Database,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Plus,
  MoreHorizontal,
  Server,
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
  Settings,
  Play,
  Star,
  FolderOpen,
} from 'lucide-react'
import { useDbStore, createDefaultConnection } from '@/store/dbStore'
import { useTranslation } from '@/store/i18nStore'
import {
  DbConnection,
  DatabaseType,
  DATABASE_CONFIGS,
  TableInfo,
  DatabaseInfo,
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
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {connection ? t('database.editConnection') : t('database.newConnection')}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* 连接名称 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('database.connectionName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('database.connectionName')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* 数据库类型 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.host')}
                </label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="localhost"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.port')}
                </label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          {/* 用户名和密码 */}
          {form.type !== 'sqlite' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.username')}
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('database.password')}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          )}

          {/* 默认数据库 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('database.defaultDatabase')} <span className="text-gray-400">({t('common.none')})</span>
            </label>
            <input
              type="text"
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
              testResult.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {testing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {t('database.testConnection')}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
}: {
  connection: DbConnection
  isActive: boolean
  onConnect: () => void
  onDisconnect: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onSelect: () => void
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
      className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
      onClick={onSelect}
    >
      {/* 状态指示器 */}
      <div className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} />

      {/* 数据库图标 */}
      <Database
        className="w-4 h-4 flex-shrink-0"
        style={{ color: DB_COLORS[connection.type] }}
      />

      {/* 连接名称 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {connection.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
            <XCircle className="w-4 h-4" />
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
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
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
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onEdit()
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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

// 树节点组件
function TreeNode({
  name,
  icon: Icon,
  nodeId,
  expanded,
  loading,
  children,
  onClick,
  onToggle,
  rightElement,
  level = 0,
}: {
  name: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  nodeId: string
  expanded?: boolean
  loading?: boolean
  children?: React.ReactNode
  onClick?: () => void
  onToggle?: () => void
  rightElement?: React.ReactNode
  level?: number
}) {
  const hasChildren = children && React.Children.count(children) > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer group"
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={onClick}
      >
        {/* 展开/折叠按钮 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.()
            }}
            className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* 图标 */}
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />

        {/* 名称 */}
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
          {name}
        </span>

        {/* 右侧元素 */}
        {rightElement}
      </div>

      {/* 子节点 */}
      {hasChildren && expanded && (
        <div>{children}</div>
      )}
    </div>
  )
}

export default function DbSidebar() {
  const { t } = useTranslation()
  const {
    connections,
    activeConnectionId,
    activeDatabase,
    selectedTable,
    savedQueries,
    expandedNodes,
    addConnection,
    updateConnection,
    deleteConnection,
    duplicateConnection,
    setActiveConnection,
    setActiveDatabase,
    setSelectedTable,
    connect,
    disconnect,
    getCachedDatabases,
    getCachedTables,
    cacheDatabases,
    cacheTables,
    toggleNodeExpand,
    createQueryTab,
  } = useDbStore()

  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DbConnection | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  })
  const [loadingDatabases, setLoadingDatabases] = useState<string | null>(null)
  const [loadingTables, setLoadingTables] = useState<string | null>(null)

  const activeConnection = connections.find((c) => c.id === activeConnectionId)

  // 加载数据库列表
  const loadDatabases = async (connectionId: string) => {
    if (getCachedDatabases(connectionId)) return

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

  // 加载表列表
  const loadTables = async (connectionId: string, database: string) => {
    if (getCachedTables(connectionId, database)) return

    setLoadingTables(`${connectionId}:${database}`)
    try {
      if (window.electronAPI?.dbGetTables) {
        const result = await window.electronAPI.dbGetTables(connectionId, database)
        if (result.success && result.tables) {
          cacheTables(connectionId, database, result.tables)
        }
      }
    } finally {
      setLoadingTables(null)
    }
  }

  // 处理连接节点展开
  const handleConnectionExpand = (connectionId: string) => {
    toggleNodeExpand(`conn:${connectionId}`)
    const connection = connections.find((c) => c.id === connectionId)
    if (connection?.connected) {
      loadDatabases(connectionId)
    }
  }

  // 处理数据库节点展开
  const handleDatabaseExpand = (connectionId: string, database: string) => {
    toggleNodeExpand(`db:${connectionId}:${database}`)
    loadTables(connectionId, database)
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

  // 获取缓存的数据库
  const databases = activeConnectionId ? getCachedDatabases(activeConnectionId) : undefined

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 px-3 h-9 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium text-gray-900 dark:text-white">{t('database.databases')}</span>
        </div>
        <button
          onClick={() => {
            setEditingConnection(null)
            setShowConnectionDialog(true)
          }}
          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
          title={t('database.newConnection')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 连接列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {connections.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('database.noConnections')}</p>
            <button
              onClick={() => {
                setEditingConnection(null)
                setShowConnectionDialog(true)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('database.newConnection')}
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {connections.map((connection) => (
              <div key={connection.id}>
                {/* 连接项 */}
                <ConnectionItem
                  connection={connection}
                  isActive={activeConnectionId === connection.id}
                  onConnect={() => connect(connection.id)}
                  onDisconnect={() => disconnect(connection.id)}
                  onEdit={() => {
                    setEditingConnection(connection)
                    setShowConnectionDialog(true)
                  }}
                  onDelete={() => setDeleteConfirm({ isOpen: true, id: connection.id, name: connection.name })}
                  onDuplicate={() => duplicateConnection(connection.id)}
                  onSelect={() => setActiveConnection(connection.id)}
                />

                {/* 已连接时显示数据库树 */}
                {connection.connected && activeConnectionId === connection.id && (
                  <div className="ml-4 mt-1">
                    {/* 数据库列表 */}
                    {(loadingDatabases === connection.id ? [] : (getCachedDatabases(connection.id) || [])).map((db) => (
                      <TreeNode
                        key={db.name}
                        name={db.name}
                        icon={FolderOpen}
                        nodeId={`db:${connection.id}:${db.name}`}
                        expanded={expandedNodes.has(`db:${connection.id}:${db.name}`)}
                        loading={loadingTables === `${connection.id}:${db.name}`}
                        onToggle={() => handleDatabaseExpand(connection.id, db.name)}
                        onClick={() => setActiveDatabase(db.name)}
                        rightElement={
                          <span className="text-xs text-gray-400">{db.tableCount}</span>
                        }
                        level={1}
                      >
                        {/* 表 */}
                        {expandedNodes.has(`db:${connection.id}:${db.name}`) && (
                          <>
                            {(getCachedTables(connection.id, db.name) || [])
                              .filter((t) => t.type === 'TABLE')
                              .map((table) => (
                                <TreeNode
                                  key={table.name}
                                  name={table.name}
                                  icon={Table}
                                  nodeId={`table:${connection.id}:${db.name}:${table.name}`}
                                  onClick={() => {
                                    setActiveDatabase(db.name)
                                    setSelectedTable(table.name, 'TABLE')
                                  }}
                                  level={2}
                                />
                              ))}
                          </>
                        )}
                      </TreeNode>
                    ))}
                    {loadingDatabases === connection.id && (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 收藏查询 */}
        {savedQueries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 px-2 mb-2">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('database.savedQueries')}</span>
            </div>
            <div className="space-y-1">
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer"
                  onClick={() => {
                    createQueryTab(query.name, query.sql)
                  }}
                >
                  <FileCode className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {query.name}
                  </span>
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
    </div>
  )
}