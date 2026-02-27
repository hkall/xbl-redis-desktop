import React, { useEffect, useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, RefreshCw, Trash2, Key, Database, X, Search, Plus } from 'lucide-react'
import { useRedisStore, RedisDataType } from '@/store/redisStore'
import ConfirmDialog from './ConfirmDialog'

interface TreeNode {
  name: string
  type: 'folder' | 'file'
  children?: TreeNode[]
  data?: { name: string; type: RedisDataType; ttl: number; size: number }
  path: string
  count?: number // Total keys count for folders
}

interface AddKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (keyName: string, keyType: RedisDataType, value: string, ttl?: number) => void
}

function AddKeyModal({ isOpen, onClose, onSave }: AddKeyModalProps) {
  const [keyName, setKeyName] = useState('')
  const [keyType, setKeyType] = useState<RedisDataType>('string')
  const [keyValue, setKeyValue] = useState('')
  const [ttl, setTtl] = useState<number | ''>('')

  useEffect(() => {
    if (isOpen) {
      setKeyName('')
      setKeyType('string')
      setKeyValue('')
      setTtl('')
    }
  }, [isOpen])

  const handleSave = () => {
    if (!keyName.trim()) return
    const ttlValue = ttl === '' ? undefined : Number(ttl)
    onSave(keyName.trim(), keyType, keyValue, ttlValue)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add New Key</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Key Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Key Name
            </label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., user:123"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Key Type */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Key Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              <button
                type="button"
                onClick={() => setKeyType('string')}
                className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                  keyType === 'string'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                String
              </button>
              <button
                type="button"
                onClick={() => setKeyType('hash')}
                className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                  keyType === 'hash'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                Hash
              </button>
              <button
                type="button"
                onClick={() => setKeyType('list')}
                className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                  keyType === 'list'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setKeyType('set')}
                className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                  keyType === 'set'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                Set
              </button>
              <button
                type="button"
                onClick={() => setKeyType('zset')}
                className={`px-2 py-2 rounded text-xs font-medium transition-colors ${
                  keyType === 'zset'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                }`}
              >
                ZSet
              </button>
            </div>
          </div>

          {/* Key Value */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Value
            </label>
            <textarea
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={
                keyType === 'hash' ? '{"field": "value"}' :
                keyType === 'list' ? '[{"item1"}, {"item2"}]' :
                keyType === 'set' ? '[{"member1"}, {"member2"}]' :
                keyType === 'zset' ? '[{"member": 1.0}, {"member2": 2.0}]' :
                'Enter value...'
              }
              rows={4}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* TTL */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              TTL (seconds) <span className="text-gray-400 font-normal">- Optional</span>
            </label>
            <input
              type="number"
              value={ttl}
              onChange={(e) => setTtl(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="Leave empty for no expiration"
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!keyName.trim()}
            className="px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KeyBrowser() {
  const {
    activeConnectionId,
    connections,
    keys,
    keysLoading,
    keysTypeFilter,
    setKeys,
    setKeysLoading,
    setKeysTypeFilter,
    selectedKey,
    setSelectedKey,
  } = useRedisStore()

  const [refreshing, setRefreshing] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showAddKeyModal, setShowAddKeyModal] = useState(false)
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

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

  useEffect(() => {
    if (activeConnection?.connected) {
      loadKeys()
    }
  }, [activeConnectionId, activeConnection?.connected, activeConnection?.database])

  // Build folder structure from keys
  const buildTree = useMemo(() => {
    const tree: TreeNode[] = []

    // First, collect keys grouped by their type
    const filteredByType = keysTypeFilter === 'all'
      ? keys
      : keys.filter((k) => k.type === keysTypeFilter)

    // Apply search filter
    const filteredKeys = searchInput.trim()
      ? filteredByType.filter((k) => k.name.toLowerCase().includes(searchInput.trim().toLowerCase()))
      : filteredByType

    // Helper function to check if string starts with Chinese character
    const isChineseStart = (str: string) => {
      if (!str) return false
      const firstChar = str.charAt(0)
      return /[\u4e00-\u9fa5]/.test(firstChar)
    }

    // Sort keys: English first (a-z), then Chinese keys
    filteredKeys.sort((a, b) => {
      const aIsChinese = isChineseStart(a.name)
      const bIsChinese = isChineseStart(b.name)

      if (aIsChinese && !bIsChinese) return 1
      if (!aIsChinese && bIsChinese) return -1

      // Same type: sort alphabetically
      return a.name.localeCompare(b.name)
    })

    // Build tree structure and count keys per folder
    filteredKeys.forEach((key) => {
      const parts = key.name.split(':')
      let currentPath = ''
      let currentLevel = tree

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        currentPath = currentPath ? `${currentPath}:${part}` : part

        if (isLast) {
          // This is a file (actual key)
          currentLevel.push({
            name: part,
            type: 'file',
            data: key,
            path: currentPath,
          })
        } else {
          // This is a folder
          let folder = currentLevel.find(
            (node) => node.type === 'folder' && node.name === part
          )

          if (!folder) {
            folder = {
              name: part,
              type: 'folder',
              children: [],
              path: currentPath,
              count: 0,
            }
            currentLevel.push(folder)
          }

          currentLevel = folder.children!
        }
      }
    })

    // Recursively sort tree nodes: folders first, then files, both alphabetically (English first, then Chinese)
    function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
      return nodes.sort((a, b) => {
        // Folders (with children) come before files
        const aIsFolder = a.type === 'folder'
        const bIsFolder = b.type === 'folder'

        if (aIsFolder && !bIsFolder) return -1
        if (!aIsFolder && bIsFolder) return 1

        // Same type: sort alphabetically with English first, then Chinese
        const aIsChinese = isChineseStart(a.name)
        const bIsChinese = isChineseStart(b.name)

        if (aIsChinese && !bIsChinese) return 1
        if (!aIsChinese && bIsChinese) return -1

        // Same language type: sort alphabetically
        return a.name.localeCompare(b.name)
      }).map(node => {
        if (node.type === 'folder' && node.children) {
          return { ...node, children: sortTreeNodes(node.children) }
        }
        return node
      })
    }

    const sortedTree = sortTreeNodes(tree)

    // Count keys for each folder (recursively)
    function countFolderKeys(node: TreeNode): number {
      if (node.type === 'file') return 1

      if (node.children) {
        const count = node.children.reduce((sum, child) => sum + countFolderKeys(child), 0)
        node.count = count
        return count
      }
      return 0
    }

    sortedTree.forEach((node) => countFolderKeys(node))

    return sortedTree
  }, [keys, keysTypeFilter, searchInput])

  const loadKeys = async () => {
    if (!activeConnection?.connected || !activeConnectionId) return

    setKeysLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.redisScan) {
        const result = await window.electronAPI.redisScan(
          activeConnectionId,
          '*',
          1000
        )

        if (result.success && result.data) {
          const keyInfos = await Promise.all(
            result.data.map(async (key) => {
              const infoResult = await window.electronAPI.redisKeyInfo(activeConnectionId, key)
              if (infoResult.success && infoResult.data) {
                return infoResult.data
              }
              return null
            })
          )

          const validKeys = keyInfos.filter(Boolean)
          setKeys(validKeys)
        }
      } else {
        const mockKeys = [
          { name: 'user:1', type: 'string' as RedisDataType, ttl: -1, size: 50 },
          { name: 'session:abc123', type: 'string' as RedisDataType, ttl: 3600, size: 128 },
          { name: 'cache:products', type: 'hash' as RedisDataType, ttl: -1, size: 5 },
          { name: 'cache:settings', type: 'string' as RedisDataType, ttl: -1, size: 200 },
          { name: 'queue:tasks', type: 'list' as RedisDataType, ttl: -1, size: 12 },
          { name: 'online:users', type: 'set' as RedisDataType, ttl: 300, size: 8 },
          { name: 'leaderboard', type: 'zset' as RedisDataType, ttl: -1, size: 3 },
          { name: 'config:app:settings', type: 'string' as RedisDataType, ttl: -1, size: 200 },
          { name: 'config:db:connection', type: 'string' as RedisDataType, ttl: -1, size: 150 },
          { name: 'user:profile:12345', type: 'hash' as RedisDataType, ttl: 86400, size: 10 },
        ]

        const keyInfos = mockKeys.map(key => ({
          name: key.name,
          type: key.type,
          ttl: key.ttl,
          size: key.size,
        }))

        setKeys(keyInfos)
      }
    } catch (error) {
      console.error('Failed to load keys:', error)
    } finally {
      setKeysLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    if (refreshing || !activeConnection?.connected) return
    setRefreshing(true)
    loadKeys()
  }

  const handleTypeFilterChange = (filter: RedisDataType | 'all') => {
    setKeysTypeFilter(filter)
  }

  const handleClearSearch = () => {
    setSearchInput('')
  }

  const handleToggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleDeleteKey = async (keyName: string) => {
    if (!activeConnectionId) return
    setDeleteConfirm({
      isOpen: true,
      callback: async () => {
        try {
          if (window.electronAPI && window.electronAPI.redisDelete) {
            const result = await window.electronAPI.redisDelete(activeConnectionId, keyName)
            if (result.success) {
              loadKeys()
              if (selectedKey === keyName) {
                setSelectedKey(null)
              }
            }
          } else {
            loadKeys()
            if (selectedKey === keyName) {
              setSelectedKey(null)
            }
          }
        } catch (error) {
          console.error('Failed to delete key:', error)
        }
      },
      title: 'Delete Key',
      message: `Are you sure you want to delete key "${keyName}"?`,
    })
  }

  const handleAddKeyClick = () => {
    setShowAddKeyModal(true)
  }

  const handleAddKey = async (keyName: string, keyType: RedisDataType, value: string, ttl?: number) => {
    if (!activeConnectionId) return

    try {
      if (window.electronAPI && window.electronAPI.redisSet) {
        let result
        if (keyType === 'string') {
          result = await window.electronAPI.redisSet(activeConnectionId, keyName, 'string', value)
        } else if (keyType === 'hash') {
          try {
            const parsed = JSON.parse(value)
            if (typeof parsed === 'object' && parsed !== null) {
              // Set each field
              const entries = Object.entries(parsed)
              for (const [field, val] of entries) {
                await window.electronAPI.redisSet(activeConnectionId, keyName, 'hash', { field, value: String(val) })
              }
              result = { success: true }
            }
          } catch {
            result = { success: false, error: 'Invalid JSON for hash' }
          }
        } else if (keyType === 'list') {
          try {
            const parsed = JSON.parse(value)
            const items = Array.isArray(parsed) ? parsed : [value]
            for (const item of items) {
              await window.electronAPI.redisSet(activeConnectionId, keyName, 'list', { action: 'push', direction: 'right', value: String(item) })
            }
            result = { success: true }
          } catch {
            await window.electronAPI.redisSet(activeConnectionId, keyName, 'list', { action: 'push', direction: 'right', value })
            result = { success: true }
          }
        } else if (keyType === 'set') {
          try {
            const parsed = JSON.parse(value)
            const members = Array.isArray(parsed) ? parsed : [value]
            for (const member of members) {
              await window.electronAPI.redisSet(activeConnectionId, keyName, 'set', { action: 'add', member: String(member) })
            }
            result = { success: true }
          } catch {
            await window.electronAPI.redisSet(activeConnectionId, keyName, 'set', { action: 'add', member: value })
            result = { success: true }
          }
        } else if (keyType === 'zset') {
          try {
            const parsed = JSON.parse(value)
            const members = Array.isArray(parsed) ? parsed : [{ member: value, score: 1.0 }]
            for (const m of members) {
              const member = typeof m === 'string' || typeof m === 'number' ? m : m?.member || m
              const score = typeof m === 'object' && m?.score ? parseFloat(String(m.score)) : 1.0
              await window.electronAPI.redisSet(activeConnectionId, keyName, 'zset', { action: 'add', score, member: String(member) })
            }
            result = { success: true }
          } catch {
            result = { success: false, error: 'Invalid JSON for zset' }
          }
        }

        if (result?.success) {
          // Set TTL if specified
          if (ttl !== undefined && ttl > 0) {
            await window.electronAPI.redisSetTTL(activeConnectionId, keyName, ttl)
          }
          loadKeys()
        }
      } else {
        // Mock mode
        const mockKey = {
          name: keyName,
          type: keyType,
          ttl: ttl ?? -1,
          size: value?.length || 0
        } as const
        setKeys([...keys, mockKey])
      }
    } catch (error) {
      console.error('Failed to add key:', error)
    }
  }

  // formatTTL is defined but not used - commented out to avoid error
  // const formatTTL = (ttl: number) => {
  //   if (ttl < 0) return '-1'
  //   if (ttl === 0) return 'Expired'
  //   if (ttl < 60) return `${ttl}s`
  //   if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`
  //   return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
  // }

  const getTypeDisplayName = (type: RedisDataType) => {
    const names: Record<string, string> = {
      string: 'String',
      hash: 'Hash',
      list: 'List',
      set: 'Set',
      zset: 'ZSet'
    }
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1)
  }

  const getTypeColor = (type: RedisDataType) => {
    const colors = {
      string: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      hash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      list: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      set: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      zset: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
    }
    return colors[type]
  }

  const getFilteredCount = useMemo(() => {
    const filteredByType = keysTypeFilter === 'all'
      ? keys
      : keys.filter((k) => k.type === keysTypeFilter)

    return searchInput.trim()
      ? filteredByType.filter((k) => k.name.toLowerCase().includes(searchInput.trim().toLowerCase())).length
      : filteredByType.length
  }, [keys, keysTypeFilter, searchInput])

  // Render tree node
  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.path)
    const isSelected = selectedKey === node.path

    if (node.type === 'folder') {
      return (
        <div key={node.path}>
          <div
            onClick={() => handleToggleFolder(node.path)}
            className="flex items-center gap-1 py-1 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            style={{ paddingLeft: `${8 + level * 16}px` }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
            <Database className="w-3 h-3 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{node.name}</span>
            {node.count !== undefined && node.count > 0 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">({node.count})</span>
            )}
          </div>
          {isExpanded && node.children && (
            <div>
              {node.children.map((child) => renderTreeNode(child, level + 1))}
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div
          key={node.path}
          onClick={() => setSelectedKey(node.path)}
          className="group flex items-center gap-1 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
          style={{ paddingLeft: `${8 + level * 16}px` }}
          title={node.path}
        >
          <div className={`flex-1 min-w-0 ${isSelected ? 'bg-red-50 dark:bg-red-900/20 rounded' : ''}`}>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${getTypeColor(node.data!.type)}`}
              >
                {getTypeDisplayName(node.data!.type)}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-400 truncate">
                {node.name}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDeleteKey(node.path)
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity flex-shrink-0"
            title="Delete key"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )
    }
  }

  if (!activeConnection) {
    return (
      <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="px-3 h-10 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">Keys</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <p className="text-gray-400 text-center text-sm">
            Select a connection to view keys
          </p>
        </div>
      </div>
    )
  }

  if (!activeConnection.connected) {
    return (
      <div className="h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="px-3 h-10 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">Keys</h2>
        </div>
        <div className="flex-1 flex items-center justify-center min-w-0">
          <p className="text-gray-400 text-center text-sm">
            Connect to view keys
          </p>
        </div>
      </div>
    )
  }

  const isBrowserMode = !window.electronAPI || !window.electronAPI.redisScan

  return (
    <div className="w-full h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header - fixed height */}
      <div className="px-3 h-10 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">Keys</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handleAddKeyClick}
            disabled={!activeConnection?.connected}
            className="p-1.5 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Add new key"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing || keysLoading}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors disabled:opacity-50 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Refresh keys"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search and filter bar */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search keys..."
            className="w-full pl-8 pr-6 py-1.5 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          {searchInput && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type filter buttons */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => handleTypeFilterChange('all')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
              keysTypeFilter === 'all'
                ? 'bg-gray-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {(Object.keys({ string: '', hash: '', list: '', set: '', zset: '' }) as RedisDataType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeFilterChange(type)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                keysTypeFilter === type
                  ? getTypeColor(type)
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
              }`}
            >
              {getTypeDisplayName(type)}
            </button>
          ))}
        </div>

        {searchInput && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getFilteredCount} key{getFilteredCount !== 1 ? 's' : ''} found
          </div>
        )}

        {isBrowserMode && (
          <div className="p-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-400 flex-shrink-0">
            Browser mode: Showing mock data.
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {keysLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : buildTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Key className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">
              {searchInput ? 'No keys found' : 'No keys found'}
            </p>
          </div>
        ) : (
          <div className="p-1">
            {buildTree.map((node) => renderTreeNode(node))}
          </div>
        )}
      </div>

      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
        {getFilteredCount} key{getFilteredCount !== 1 ? 's' : ''}{keys.length !== getFilteredCount && ` of ${keys.length} total`}
      </div>

      {/* Add Key Modal */}
      <AddKeyModal
        isOpen={showAddKeyModal}
        onClose={() => setShowAddKeyModal(false)}
        onSave={handleAddKey}
      />

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