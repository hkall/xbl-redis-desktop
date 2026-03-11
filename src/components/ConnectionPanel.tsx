import React, { useState, useEffect } from 'react'
import { Trash2, Database, CheckCircle, XCircle, Loader2, AlertCircle, Edit3, Link, X, ChevronDown, Terminal, Server, List, Download, Key, Copy } from 'lucide-react'
import { useRedisStore, RedisConnection } from '@/store/redisStore'
import ConfirmDialog from './ConfirmDialog'

type PanelType = 'keys' | 'command' | 'server' | 'batch' | 'export'

const PANEL_CONFIG = {
  keys: { label: 'Keys', icon: Key, color: 'blue' as const },
  command: { label: 'CLI', icon: Terminal, color: 'gray' as const },
  server: { label: 'Server', icon: Server, color: 'purple' as const },
  batch: { label: 'Batch', icon: List, color: 'orange' as const },
  export: { label: 'Export', icon: Download, color: 'green' as const },
}

export default function ConnectionPanel({ selectedPanel, onPanelChange }: { selectedPanel: PanelType; onPanelChange: (panel: PanelType) => void }) {
  const {
    connections,
    activeConnectionId,
    setActiveConnection,
    removeConnection,
    addConnection,
    updateConnectionStatus,
    updateConnectionConfig,
    updateDatabaseInfo,
    setKeys,
    setSelectedKey,
  } = useRedisStore()

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingConnection, setEditingConnection] = useState<string | null>(null)
  const [newConnection, setNewConnection] = useState({
    name: '',
    host: 'localhost',
    port: 6379,
    password: '',
    database: 0,
    mode: 'standalone' as 'standalone' | 'sentinel' | 'cluster',
  })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    callback: () => void
    title: string
    message: string
  }>({
    isOpen: false,
    callback: () => {},
    title: '',
    message: '',
  })

  const [copyConfirm, setCopyConfirm] = useState<{
    isOpen: boolean
    connection: RedisConnection | null
  }>({
    isOpen: false,
    connection: null,
  })

  const handleCopyConnection = () => {
    if (copyConfirm.connection) {
      const newConn = {
        name: `${copyConfirm.connection.name} (copy)`,
        host: copyConfirm.connection.host,
        port: copyConfirm.connection.port,
        password: copyConfirm.connection.password || '',
        database: copyConfirm.connection.database,
        mode: copyConfirm.connection.mode,
      }
      addConnection(newConn)
      setCopyConfirm({ isOpen: false, connection: null })
    }
  }

  const handleAddConnection = async () => {
    addConnection(newConnection)
    setShowAddForm(false)
    setNewConnection({
      name: '',
      host: 'localhost',
      port: 6379,
      password: '',
      database: 0,
      mode: 'standalone',
    })
  }

  const handleUpdateConnection = async () => {
    if (editingConnection) {
      const currentConnection = connections.find(c => c.id === editingConnection)
      const isDbChanged = currentConnection && currentConnection.database !== newConnection.database
      const isConnected = currentConnection?.connected

      updateConnectionConfig(editingConnection, newConnection)

      // If database changed and connection is active, re-connect to switch database
      if (isDbChanged && isConnected) {
        await handleConnect({ ...newConnection, id: editingConnection, connected: true, connecting: false } as RedisConnection)
      }

      setEditingConnection(null)
      setShowAddForm(false)
      setNewConnection({
        name: '',
        host: 'localhost',
        port: 6379,
        password: '',
        database: 0,
        mode: 'standalone',
      })
    }
  }

  const handleConnect = async (connection: RedisConnection) => {
    updateConnectionStatus(connection.id, { connecting: true, error: undefined })

    try {
      // Check if electronAPI is available (running in Electron)
      if (window.electronAPI && window.electronAPI.redisConnect) {
        // Real connection via Electron IPC
        const result = await window.electronAPI.redisConnect(
          connection.id,
          {
            host: connection.host,
            port: connection.port,
            password: connection.password || undefined,
            db: connection.database,
          }
        )

        if (result.success) {
          // Use the db returned from the connection (ensures we have the correct db index)
          const connectedDb = result.db !== undefined ? result.db : connection.database
          // Update the connection's database field to ensure it matches what we connected to
          updateConnectionConfig(connection.id, { database: connectedDb, name: connection.name, host: connection.host, port: connection.port, password: connection.password, mode: connection.mode })
          updateConnectionStatus(connection.id, { connected: true, connecting: false })
          // Also set this as active connection
          setActiveConnection(connection.id)
          // Load database info
          loadDatabaseInfo(connection.id)
        } else {
          updateConnectionStatus(connection.id, {
            connected: false,
            connecting: false,
            error: result.error || 'Connection failed',
          })
        }
      } else {
        // Running in browser (dev mode without Electron)
        // Simulate connection for testing UI
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Simulate success for localhost testing
        if (connection.host === 'localhost' || connection.host === '127.0.0.1') {
          updateConnectionConfig(connection.id, { database: connection.database as number, password: connection.password, mode: 'standalone', name: connection.name, host: connection.host, port: connection.port })
          updateConnectionStatus(connection.id, {
            connected: true,
            connecting: false,
          })
          setActiveConnection(connection.id)
        } else {
          updateConnectionStatus(connection.id, {
            connected: false,
            connecting: false,
            error: 'Browser mode: cannot connect to remote Redis. Use Electron app for real connections.',
          })
        }
      }
    } catch (error) {
      updateConnectionStatus(connection.id, {
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    }
  }

  const loadDatabaseInfo = async (connectionId: string) => {
    if (!window.electronAPI || !window.electronAPI.redisInfo) return
    const result = await window.electronAPI.redisInfo(connectionId)
    if (result.success && result.data) {
      updateDatabaseInfo(connectionId, result.data)
    }
  }

  const handleDisconnect = async (connection: RedisConnection) => {
    updateConnectionStatus(connection.id, { connecting: true, error: undefined })

    try {
      if (window.electronAPI && window.electronAPI.redisDisconnect) {
        await window.electronAPI.redisDisconnect(connection.id)
      }

      updateConnectionStatus(connection.id, {
        connected: false,
        connecting: false,
      })

      // Clear active connection and data if disconnecting the active one
      if (activeConnectionId === connection.id) {
        setActiveConnection(null)
        setKeys([])
        setSelectedKey(null)
      }
    } catch (error) {
      updateConnectionStatus(connection.id, {
        connected: false,
        connecting: false,
        error: error instanceof Error ? error.message : 'Disconnection failed',
      })
    }
  }

  const handleSelectDatabase = async (connection: RedisConnection, db: number) => {
    // Disconnect and reconnect with new database to ensure proper switching
    const tempConnection = { ...connection, database: db }
    await handleConnect(tempConnection)
  }

  const openEditForm = (connection: RedisConnection) => {
    setEditingConnection(connection.id)
    setNewConnection({
      name: connection.name,
      host: connection.host,
      port: connection.port,
      password: connection.password ?? '',
      database: connection.database,
      mode: connection.mode,
    })
    setShowAddForm(true)
  }

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 flex flex-col overflow-hidden">
      <div className="px-3 h-9 border-b border-black/10 dark:border-white/10 flex-shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Database className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">
            Connections
          </span>
          {activeConnection?.connected && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="truncate" title={activeConnection.name}>
                {activeConnection.name}
              </span>
            </span>
          )}
        </div>
        <button
          onClick={() => {
            setEditingConnection(null)
            setNewConnection({
              name: '',
              host: 'localhost',
              port: 6379,
              password: '',
              database: 0,
              mode: 'standalone',
            })
            setShowAddForm(true)
          }}
          className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white font-medium text-xs py-1 px-2.5 rounded-md transition-colors flex-shrink-0 whitespace-nowrap"
          title="New Connection"
        >
          <Link className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-16">
        {connections.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
            No connections yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {connections.map((connection) => (
              <ConnectionItem
                key={connection.id}
                connection={connection}
                isActive={connection.id === activeConnectionId}
                onConnect={() => handleConnect(connection)}
                onDisconnect={() => handleDisconnect(connection)}
                onDelete={() => setDeleteConfirm({
                  isOpen: true,
                  callback: () => removeConnection(connection.id),
                  title: 'Delete Connection',
                  message: `Are you sure you want to delete connection "${connection.name}"?`,
                })}
                onEdit={() => openEditForm(connection)}
                onSelectDatabase={(db) => handleSelectDatabase(connection, db)}
                onCopy={() => setCopyConfirm({ isOpen: true, connection })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Panel Switcher - Fixed at bottom of Connection Panel */}
      <div className="flex-shrink-0 h-[52px] px-2 py-1 border-t border-black/10 dark:border-white/10 bg-gray-50 dark:bg-gray-800/50 flex items-center">
        <div className="grid grid-cols-5 gap-1 w-full">
          {Object.entries(PANEL_CONFIG).map(([id, panel]) => (
            <button
              key={id}
              onClick={() => onPanelChange(id as PanelType)}
              className={`flex flex-col items-center justify-center rounded-lg transition-all duration-200 py-1 ${
                selectedPanel === id
                  ? id === 'keys'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={panel.label}
            >
              {panel.icon && <panel.icon className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-medium leading-none">{panel.label}</span>
            </button>
          ))}
        </div>
      </div>

      {showAddForm && (
        <AddConnectionForm
          connection={newConnection}
          onChange={setNewConnection}
          onSubmit={editingConnection ? handleUpdateConnection : handleAddConnection}
          onCancel={() => {
            setShowAddForm(false)
            setEditingConnection(null)
          }}
          isEdit={editingConnection !== null}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          deleteConfirm.callback()
          setDeleteConfirm({ isOpen: false, callback: () => {}, title: '', message: '' })
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, callback: () => {}, title: '', message: '' })}
      />

      <ConfirmDialog
        isOpen={copyConfirm.isOpen}
        title="Copy Connection"
        message={`Create a copy of "${copyConfirm.connection?.name}"? The new connection will be named "${copyConfirm.connection?.name} (copy)".`}
        confirmText="Copy"
        cancelText="Cancel"
        variant="info"
        onConfirm={handleCopyConnection}
        onCancel={() => setCopyConfirm({ isOpen: false, connection: null })}
      />
    </div>
  )
}

function ConnectionItem({
  connection,
  isActive,
  onConnect,
  onDisconnect,
  onDelete,
  onEdit,
  onSelectDatabase,
  onCopy,
}: {
  connection: RedisConnection
  isActive: boolean
  onConnect: () => void
  onDisconnect: () => void
  onDelete: () => void
  onEdit: () => void
  onSelectDatabase: (db: number) => void
  onCopy: () => void
}) {
  const [showDbDropdown, setShowDbDropdown] = useState(false)

  const databaseInfo = connection.databaseInfo || {}
  const maxDb = Math.max(...Object.keys(databaseInfo).map(Number), connection.database)
  const dbOptions = Array.from({ length: maxDb + 1 }, (_, i) => i)

  useEffect(() => {
    if (connection.connected) {
      loadDatabaseInfo()
    }
  }, [connection.connected, connection.database, connection.id])

  const loadDatabaseInfo = async () => {
    if (window.electronAPI && window.electronAPI.redisInfo) {
      const result = await window.electronAPI.redisInfo(connection.id)
      if (result.success && result.data) {
        useRedisStore.getState().updateDatabaseInfo(connection.id, result.data)
      }
    }
  }

  return (
    <div
      onClick={() => useRedisStore.getState().setActiveConnection(connection.id)}
      className={`p-3 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700'
          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
      }`}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="font-medium text-gray-900 dark:text-white text-sm truncate min-w-0" title={connection.name}>
          {connection.name}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
            className="text-gray-400 hover:text-green-500 transition-colors"
            title="Copy connection"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="text-gray-400 hover:text-blue-500 transition-colors"
            title="Edit connection"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Delete connection"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Database selector for connected connections */}
      {connection.connected && (
        <div className="mt-2">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDbDropdown(!showDbDropdown)
              }}
              className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors w-full"
            >
              <span>DB: {connection.database}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showDbDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDbDropdown && (
              <DatabaseDropdown
                currentDb={connection.database}
                databases={dbOptions}
                databaseInfo={databaseInfo}
                onSelect={(db) => {
                  onSelectDatabase(db)
                  setShowDbDropdown(false)
                }}
                onClose={() => setShowDbDropdown(false)}
              />
            )}
          </div>

          <div className="flex items-center gap-1 mt-1.5">
            <StatusIndicator
              connection={connection}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          </div>
        </div>
      )}

      {!connection.connected && (
        <div className="flex items-center gap-1 mt-2">
          <StatusIndicator
            connection={connection}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        </div>
      )}

      {connection.error && !connection.connected && !connection.connecting && (
        <div className="mt-2 flex items-start gap-1 text-xs text-red-500">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span className="break-all">{connection.error}</span>
        </div>
      )}
    </div>
  )
}

function DatabaseDropdown({
  currentDb,
  databases,
  databaseInfo,
  onSelect,
  onClose,
}: {
  currentDb: number
  databases: number[]
  databaseInfo: Record<number, number>
  onSelect: (db: number) => void
  onClose: () => void
}) {
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
      style={{ minWidth: '120px' }}
    >
      {databases.map((db) => {
        const keyCount = databaseInfo[db] ?? 0
        return (
          <button
            key={db}
            onClick={() => onSelect(db)}
            className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              db === currentDb
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            <span>DB {db}</span>
            {keyCount > 0 && (
              <span className="text-gray-400 dark:text-gray-500">
                {keyCount.toLocaleString()} keys
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function StatusIndicator({
  connection,
  onConnect,
  onDisconnect,
}: {
  connection: RedisConnection
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (connection.connecting) {
    return (
      <button
        disabled
        className="text-xs text-gray-500 flex items-center gap-1"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting...
      </button>
    )
  }

  if (connection.connected) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDisconnect()
        }}
        className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 hover:text-green-700 dark:hover:text-green-300"
      >
        <CheckCircle className="w-3 h-3" />
        Connected
      </button>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onConnect()
      }}
      className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 hover:text-red-500 dark:hover:text-red-400"
    >
      <XCircle className="w-3 h-3" />
      Connect
    </button>
  )
}

function AddConnectionForm({
  connection,
  onChange,
  onSubmit,
  onCancel,
  isEdit,
}: {
  connection: Omit<RedisConnection, 'id' | 'connected' | 'connecting' | 'error' | 'databaseInfo'>
  onChange: (conn: typeof connection) => void
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
}) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!connection.name.trim()) {
      alert('Please enter a connection name')
      return
    }
    await onSubmit()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Connection' : 'New Connection'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Name *
            </label>
            <input
              type="text"
              value={connection.name}
              onChange={(e) => onChange({ ...connection, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="My Redis Server"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Host *
            </label>
            <input
              type="text"
              value={connection.host}
              onChange={(e) => onChange({ ...connection, host: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="localhost"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Port *
            </label>
            <input
              type="number"
              value={connection.port}
              onChange={(e) => onChange({ ...connection, port: parseInt(e.target.value) || 6379 })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="6379"
              min="1"
              max="65535"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Database
            </label>
            <input
              type="number"
              value={connection.database === 0 ? '' : connection.database}
              onChange={(e) => {
                const value = e.target.value
                if (value === '') {
                  onChange({ ...connection, database: 0 })
                } else {
                  const num = parseInt(value)
                  if (!isNaN(num) && num >= 0) {
                    onChange({ ...connection, database: num })
                  }
                }
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Password (optional)
            </label>
            <input
              type="password"
              value={connection.password}
              onChange={(e) => onChange({ ...connection, password: e.target.value })}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 flex justify-end gap-2 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            {isEdit ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}