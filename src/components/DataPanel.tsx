import React, { useEffect, useState } from 'react'
import { Clock, Trash2, Save, X, RefreshCw } from 'lucide-react'
import { useRedisStore } from '@/store/redisStore'
import StringViewer from './viewers/StringViewer'
import HashViewer from './viewers/HashViewer'
import ListViewer from './viewers/ListViewer'
import SetViewer from './viewers/SetViewer'
import ZSetViewer from './viewers/ZSetViewer'
import ConfirmDialog from './ConfirmDialog'

function TTLDisplay({
  ttl,
  onEdit,
  editing,
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  ttl: number
  onEdit: () => void
  editing: boolean
  value: string
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
  saving?: boolean
}) {
  const formatTTL = (ttl: number) => {
    // Treat large values (close to max int) as persistent (-1)
    if (ttl < 0) return '-1'
    if (ttl >= 2147483600) return '-1' // Values close to max int treated as -1
    if (ttl === 0) return 'Expired'
    if (ttl < 60) return `${ttl}s`
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`
    return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
  }

  return (
    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0" style={{ width: 'auto' }}>
      <Clock className="w-3 h-3" />
      <input
        type="text"
        value={editing ? value : formatTTL(ttl)}
        readOnly={!editing}
        onClick={() => !editing && onEdit()}
        onChange={(e) => editing && onChange(e.target.value)}
        placeholder="-1"
        min="-1"
        autoFocus={editing}
        onKeyDown={(e) => {
          if (editing) {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSave()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              onCancel()
            }
          }
        }}
        onMouseDown={(e) => {
          if (editing) {
            e.stopPropagation()
          }
        }}
        className={`w-16 px-1.5 py-0.5 ${
          !editing ? 'cursor-pointer' : ''
        } bg-transparent border border-transparent focus:outline-none text-center ${
          editing
            ? 'border border-red-500 dark:border-red-500 rounded'
            : 'border-b border-transparent'
        }`}
        title={!editing ? "TTL (click to edit)" : ""}
      />
      <div className={`w-5 ${editing ? '' : 'opacity-0'}`}>
        {editing && (
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSave()
            }}
            disabled={saving}
            className="p-0.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors disabled:opacity-50"
            title="Save TTL"
          >
            <Save className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function DataPanel() {
  const {
    activeConnectionId,
    connections,
    selectedKey,
    setSelectedKey,
  } = useRedisStore()

  const [keyInfo, setKeyInfo] = useState<{ type: string; ttl: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingTTL, setEditingTTL] = useState(false)
  const [ttlInput, setTtlInput] = useState('')
  const [savingTTL, setSavingTTL] = useState(false)
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
  const [refreshingData, setRefreshingData] = useState(false)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const ttlContainerRef = React.useRef<HTMLDivElement>(null)

  // 点击外部取消编辑
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (editingTTL && ttlContainerRef.current && !ttlContainerRef.current.contains(event.target as Node)) {
        setEditingTTL(false)
        setTtlInput(keyInfo?.ttl.toString() || '')
      }
    }

    if (editingTTL) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [editingTTL, keyInfo])

  // activeConnection unused variable removed
  // const activeConnection = activeConnectionId
  //   ? connections.find((c) => c.id === activeConnectionId)
  //   : null

  useEffect(() => {
    if (selectedKey && activeConnectionId) {
      loadKeyInfo()
    } else {
      setKeyInfo(null)
      setEditingTTL(false)
    }
  }, [selectedKey, activeConnectionId])

  const loadKeyInfo = async () => {
    if (!activeConnectionId || !selectedKey) return

    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.redisKeyInfo) {
        const result = await window.electronAPI.redisKeyInfo(activeConnectionId, selectedKey)
        if (result.success && result.data) {
          setKeyInfo({
            type: result.data.type,
            ttl: result.data.ttl,
          })
          setTtlInput(result.data.ttl.toString())
        } else {
          setKeyInfo(null)
        }
      }
    } catch (error) {
      console.error('Failed to load key info:', error)
      setKeyInfo(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSetTTL = async () => {
    if (!activeConnectionId || !selectedKey) {
      console.log('Missing connectionId or selectedKey')
      return
    }

    try {
      const seconds = parseInt(ttlInput)
      if (isNaN(seconds)) {
        setEditingTTL(false)
        setTtlInput(keyInfo?.ttl.toString() || '')
        return
      }

      // If setting to -1 or less, use a large value for persistent (since Redis expires max is 2^31-1)
      // Actually, persist() should be used for permanent keys
      let result
      if (seconds < 0) {
        // Try using a very large value to simulate permanent (Redis limit is 2147483647)
        const persistentSeconds = 2147483647 // Max signed 32-bit int
        result = await window.electronAPI.redisSetTTL(activeConnectionId, selectedKey, persistentSeconds)
      } else {
        result = await window.electronAPI.redisSetTTL(activeConnectionId, selectedKey, seconds)
      }

      if (result.success) {
        // Reload key info to get the actual TTL value from Redis
        await loadKeyInfo()
        setEditingTTL(false)
      } else {
        alert('Failed to set TTL: ' + (result.error || 'Unknown error'))
        setEditingTTL(false)
        setTtlInput(keyInfo?.ttl.toString() || '')
      }
    } catch (error) {
      console.error('Failed to set TTL:', error)
      alert('Failed to set TTL: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setEditingTTL(false)
      setTtlInput(keyInfo?.ttl.toString() || '')
    }
  }

  const handleCancelEdit = () => {
    setEditingTTL(false)
    setTtlInput(keyInfo?.ttl.toString() || '')
  }

  // handleClearTTL is defined but not used - comment out for now
  const handleClearTTL = async () => {
    if (!activeConnectionId || !selectedKey) return

    try {
      const result = await window.electronAPI.redisClearTTL(activeConnectionId, selectedKey)
      if (result.success) {
        setKeyInfo((prev) => prev ? { ...prev, ttl: -1 } : null)
        setTtlInput('-1')
      }
    } catch (error) {
      console.error('Failed to clear TTL:', error)
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unusedClearTTL = handleClearTTL

  const handleCopyKey = async () => {
    if (!selectedKey) return
    try {
      await navigator.clipboard.writeText(selectedKey)
      setCopiedToClipboard(true)
      setTimeout(() => setCopiedToClipboard(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleRefresh = async () => {
    if (!activeConnectionId || !selectedKey || refreshingData) return

    setRefreshingData(true)
    try {
      await loadKeyInfo()
    } finally {
      setRefreshingData(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!activeConnectionId || !selectedKey) return
    setDeleteConfirm({
      isOpen: true,
      callback: async () => {
        try {
          const result = await window.electronAPI.redisDelete(activeConnectionId, selectedKey)
          if (result.success) {
            setSelectedKey(null)
            setKeyInfo(null)
          }
        } catch (error) {
          console.error('Failed to delete key:', error)
        }
      },
      title: 'Delete Key',
      message: `Are you sure you want to delete key "${selectedKey}"?`,
    })
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      hash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      list: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      set: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      zset: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getTypeDisplayName = (type: string) => {
    const names: Record<string, string> = {
      string: 'String',
      hash: 'Hash',
      list: 'List',
      set: 'Set',
      zset: 'ZSet'
    }
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1)
  }

  if (!selectedKey) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <p className="text-gray-400 text-sm">
          Select a key to view and edit its data
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex-shrink-0 px-3 h-10 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Key info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white flex-shrink-0">Data</h2>
            {keyInfo && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getTypeColor(keyInfo.type)}`}>
                {getTypeDisplayName(keyInfo.type)}
              </span>
            )}
            <span
              className={`font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                copiedToClipboard ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : ''
              } truncate max-w-[280px]`}
              title={copiedToClipboard ? 'Copied!' : `${selectedKey} (double-click to copy)`}
              onDoubleClick={handleCopyKey}
            >
              {copiedToClipboard ? 'Copied!' : selectedKey}
            </span>
            {/* Spacer to push TTL to the right */}
            <div className="flex-1 min-w-[50px]" />
            {keyInfo && (
              <div ref={ttlContainerRef} className="ml-2">
                <TTLDisplay
                  ttl={keyInfo.ttl}
                  editing={editingTTL}
                  value={ttlInput}
                  onChange={setTtlInput}
                  onEdit={() => setEditingTTL(true)}
                  onSave={handleSetTTL}
                  onCancel={handleCancelEdit}
                  saving={savingTTL}
                />
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {keyInfo && (
              <button
                onClick={handleRefresh}
                disabled={refreshingData}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshingData ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={handleDeleteKey}
              className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Delete key"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedKey(null)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Data content - full height, no extra padding */}
      <div className="flex-1 overflow-hidden min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400 text-sm">Loading...</div>
          </div>
        ) : keyInfo ? (
          <div className="h-full min-h-0">
            {keyInfo.type === 'string' && (
              <StringViewer connectionId={activeConnectionId} keyName={selectedKey} />
            )}
            {keyInfo.type === 'hash' && (
              <HashViewer connectionId={activeConnectionId} keyName={selectedKey} />
            )}
            {keyInfo.type === 'list' && (
              <ListViewer connectionId={activeConnectionId} keyName={selectedKey} />
            )}
            {keyInfo.type === 'set' && (
              <SetViewer connectionId={activeConnectionId} keyName={selectedKey} />
            )}
            {keyInfo.type === 'zset' && (
              <ZSetViewer connectionId={activeConnectionId} keyName={selectedKey} />
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <p className="text-sm">Failed to load key</p>
          </div>
        )}
      </div>

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
    </div>
  )
}