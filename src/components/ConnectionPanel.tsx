import React, { useState, useEffect } from 'react'
import { Trash2, Database, CheckCircle, XCircle, Loader2, AlertCircle, Edit3, Link, X, ChevronDown, Terminal, Server, List, Download, Key, Copy, RefreshCw, ExternalLink } from 'lucide-react'
import { useRedisStore, RedisConnection } from '@/store/redisStore'
import ConfirmDialog from './ConfirmDialog'

const APP_VERSION = '1.2.0'

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

  // Update check state
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean
    latestVersion: string
    releaseUrl: string
    downloadUrl?: string
  } | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; downloaded: number; total: number; speed?: number } | null>(null)
  const [downloadComplete, setDownloadComplete] = useState<{ filePath: string; downloadsDir: string } | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  // For calculating download speed
  const downloadSpeedRef = React.useRef({ lastTime: 0, lastDownloaded: 0, speed: 0 })

  // Check for updates
  const checkForUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const response = await fetch('https://api.github.com/repos/hkall/xbl-redis-desktop/releases/latest')
      if (response.ok) {
        const data = await response.json()
        const latestVersion = data.tag_name?.replace(/^v/, '') || '0.0.0'

        // Compare versions
        const currentParts = APP_VERSION.split('.').map(Number)
        const latestParts = latestVersion.split('.').map(Number)

        let hasUpdate = false
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
          const current = currentParts[i] || 0
          const latest = latestParts[i] || 0
          if (latest > current) {
            hasUpdate = true
            break
          } else if (latest < current) {
            break
          }
        }

        // Find Windows installer download URL
        let downloadUrl = ''
        if (data.assets && Array.isArray(data.assets)) {
          const exeAsset = data.assets.find((asset: { name: string; browser_download_url: string }) =>
            asset.name.endsWith('.exe') && !asset.name.includes('blockmap')
          )
          if (exeAsset) {
            downloadUrl = exeAsset.browser_download_url
          }
        }

        setUpdateInfo({
          hasUpdate,
          latestVersion,
          releaseUrl: data.html_url || 'https://github.com/hkall/xbl-redis-desktop/releases',
          downloadUrl
        })
        setShowUpdateDialog(true)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setCheckingUpdate(false)
    }
  }

  // Listen for download progress
  useEffect(() => {
    if (window.electronAPI?.onUpdateProgress) {
      window.electronAPI.onUpdateProgress((data) => {
        const now = Date.now()
        const ref = downloadSpeedRef.current

        // Calculate speed every 500ms
        if (now - ref.lastTime >= 500) {
          const downloadedDiff = data.downloaded - ref.lastDownloaded
          const timeDiff = (now - ref.lastTime) / 1000 // seconds
          ref.speed = downloadedDiff / timeDiff // bytes per second
          ref.lastTime = now
          ref.lastDownloaded = data.downloaded
        }

        setDownloadProgress({
          ...data,
          speed: ref.speed
        })
      })
    }
  }, [])

  // Download update handler
  const handleDownloadUpdate = async () => {
    // Reset states
    setDownloadError(null)
    setDownloadProgress(null)
    setDownloadComplete(null)

    // Check if download API is available
    if (!window.electronAPI?.downloadUpdate) {
      setDownloadError('Download feature not available. Please update manually.')
      return
    }

    if (!updateInfo?.downloadUrl) {
      setDownloadError('No download URL available.')
      return
    }

    setDownloading(true)

    // Reset speed calculation
    downloadSpeedRef.current = { lastTime: 0, lastDownloaded: 0, speed: 0 }

    const filename = `Xbl-Redis-Desktop-Setup-${updateInfo.latestVersion}.exe`

    try {
      const result = await window.electronAPI.downloadUpdate(updateInfo.downloadUrl, filename)
      if (result?.success) {
        setDownloadComplete({ filePath: result.filePath!, downloadsDir: result.downloadsDir! })
      } else {
        setDownloadError(result?.error || 'Download failed')
      }
    } catch (error) {
      console.error('Download failed:', error)
      setDownloadError(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const handleOpenFile = async () => {
    if (downloadComplete && window.electronAPI?.openUpdateFile) {
      await window.electronAPI.openUpdateFile(downloadComplete.filePath)
    }
  }

  const handleOpenFolder = async () => {
    if (downloadComplete && window.electronAPI?.openUpdateFolder) {
      await window.electronAPI.openUpdateFolder(downloadComplete.downloadsDir)
    }
  }

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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Version display and update check */}
          <button
            onClick={checkForUpdate}
            disabled={checkingUpdate}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
            title="Check for updates"
          >
            <span className="font-mono">v{APP_VERSION}</span>
            {checkingUpdate ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </button>
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

      {/* Update Dialog */}
      {showUpdateDialog && updateInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {downloadComplete ? 'Download Complete' : updateInfo.hasUpdate ? 'Update Available' : 'Up to Date'}
              </h3>
              <button
                onClick={() => {
                  setShowUpdateDialog(false)
                  setUpdateInfo(null)
                  setDownloadProgress(null)
                  setDownloadComplete(null)
                  setDownloadError(null)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center">
              {downloadComplete ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Update downloaded successfully!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleOpenFile}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Installer
                    </button>
                    <button
                      onClick={handleOpenFolder}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Open Folder
                    </button>
                  </div>
                </>
              ) : downloadError ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-red-600 dark:text-red-400 mb-2 font-medium">
                    Download Failed
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    {downloadError}
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleDownloadUpdate}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry
                    </button>
                    <button
                      onClick={() => window.open(updateInfo.releaseUrl, '_blank')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Manual Download
                    </button>
                  </div>
                </>
              ) : downloading ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Download className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-bounce" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-3">
                    Downloading update...
                  </p>
                  {downloadProgress && (
                    <div className="w-full">
                      {/* Progress bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300 relative"
                          style={{ width: `${downloadProgress.percent}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                      </div>

                      {/* Progress info */}
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>{downloadProgress.percent}%</span>
                        <span>
                          {(downloadProgress.downloaded / 1024 / 1024).toFixed(1)} MB / {(downloadProgress.total / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </div>

                      {/* Download speed */}
                      {downloadProgress.speed && downloadProgress.speed > 0 && (
                        <div className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                          <span className="font-medium">
                            {downloadProgress.speed > 1024 * 1024
                              ? `${(downloadProgress.speed / 1024 / 1024).toFixed(1)} MB/s`
                              : `${(downloadProgress.speed / 1024).toFixed(0)} KB/s`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : updateInfo.hasUpdate ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    A new version is available!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Current: <span className="font-mono">v{APP_VERSION}</span> → Latest: <span className="font-mono text-green-600 dark:text-green-400">v{updateInfo.latestVersion}</span>
                  </p>
                  <button
                    onClick={handleDownloadUpdate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Update
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    You're using the latest version!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    <span className="font-mono">v{APP_VERSION}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
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