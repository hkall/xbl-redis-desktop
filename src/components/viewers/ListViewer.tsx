import React, { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, Search, X, Copy, Check } from 'lucide-react'
import { formatDataForEdit } from '@/utils/formatter'
import CodeEditor from '@/components/CodeEditor'
import ConfirmDialog from '../ConfirmDialog'

export interface ListViewerProps {
  connectionId: string | null
  keyName: string
}

interface EditModalProps {
  isOpen: boolean
  type: 'add' | 'edit'
  index?: number
  initialValue?: string
  onClose: () => void
  onSave: (value: string, direction?: 'left' | 'right', index?: number) => void
}

function EditModal({ isOpen, type, index, initialValue, onClose, onSave }: EditModalProps) {
  const [value, setValue] = useState('')
  const [direction, setDirection] = useState<'left' | 'right'>('right')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const formattedValue = formatDataForEdit(initialValue)
      setValue(formattedValue)
      if (type === 'add') setDirection('right')
    }
  }, [isOpen, initialValue, type])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Error already handled by UI state
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 处理 Tab 键缩进
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      setValue(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    // 处理 Ctrl/Cmd+Enter 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (value) {
        if (type === 'add') {
          onSave(value, direction)
        } else {
          onSave(value, undefined, index)
        }
        onClose()
      }
      return
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {type === 'add' ? 'Add New List Item' : `Edit Item at Index ${index}`}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Direction Selector (for Add) */}
          {type === 'add' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Insert Direction
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDirection('left')}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors ${
                    direction === 'left'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  Left (LPUSH)
                </button>
                <button
                  onClick={() => setDirection('right')}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg transition-colors ${
                    direction === 'right'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  Right (RPUSH)
                </button>
              </div>
            </div>
          )}

          {/* Value Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Value
              </label>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span>已复制</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>复制</span>
                  </>
                )}
              </button>
            </div>
            <div
              className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden"
              style={{ height: '320px' }}
            >
              <CodeEditor
                value={value}
                onChange={setValue}
                onKeyDown={handleKeyDown}
                placeholder="输入值..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {value.length} 字符 · Tab 缩进 · Ctrl+Enter 保存
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => {
                if (value) {
                  if (type === 'add') {
                    onSave(value, direction)
                  } else {
                    onSave(value, undefined, index)
                  }
                }
              }}
              disabled={!value}
              className="px-4 py-2 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {type === 'add' ? '添加项目' : '更新项目'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ITEMS_PER_PAGE = 20

export default function ListViewer({ connectionId, keyName }: ListViewerProps) {
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    type: 'add' | 'edit'
    index?: number
    initialValue?: string
  }>({
    isOpen: false,
    type: 'add',
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

  // Search and pagination state
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadKey()
  }, [connectionId, keyName])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchTerm) return items

    const term = searchTerm.toLowerCase()
    return items.filter((item) => item.toLowerCase().includes(term))
  }, [items, searchTerm])

  // Pagination with useMemo for performance
  const { paginatedItems, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return {
      paginatedItems: filteredItems.slice(start, end),
      totalPages: total
    }
  }, [filteredItems, currentPage, ITEMS_PER_PAGE])

  const loadKey = async () => {
    if (!connectionId || !keyName) return

    setLoading(true)
    setItems([])

    try {
      if (window.electronAPI && window.electronAPI.redisGet) {
        const result = await window.electronAPI.redisGet(connectionId, keyName)

        if (result.success && result.data) {
          requestAnimationFrame(() => {
            setItems(result.data as string[])
          })
        }
      }
    } catch (error) {
      // Error already handled by UI state
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async (value: string, direction: 'left' | 'right') => {
    if (!connectionId || !keyName || !value) return

    try {
      const result = await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'list',
        { action: 'push', direction, value }
      )
      if (result.success) {
        if (direction === 'left') {
          setItems([value, ...items])
        } else {
          setItems([...items, value])
        }
        setEditModal({ isOpen: false, type: 'add' })
      }
    } catch (error) {
      // Error already handled by UI state
    }
  }

  const handleDeleteItem = async (index: number, value: string) => {
    if (!connectionId || !keyName) return
    setDeleteConfirm({
      isOpen: true,
      callback: async () => {
        try {
          await window.electronAPI.redisSet(
            connectionId,
            keyName,
            'list',
            { action: 'remove', value }
          )
          setItems(items.filter((_, i) => i !== index))
        } catch (error) {
          // Error already handled by UI state
        }
      },
      title: 'Delete List Item',
      message: `Are you sure you want to delete item "${value}"?`,
    })
  }

  const handleUpdateItem = async (oldValue: string, newValue: string, index: number) => {
    if (!connectionId || !keyName || oldValue === newValue) return

    try {
      await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'list',
        { action: 'set', index, value: newValue }
      )
      const newItems = [...items]
      newItems[index] = newValue
      setItems(newItems)
      setEditModal({ isOpen: false, type: 'add' })
    } catch (error) {
      // Error already handled by UI state
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
          {filteredItems.length !== items.length && (
            <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {filteredItems.length} filtered
            </span>
          )}
        </div>
        <button
          onClick={() => setEditModal({ isOpen: true, type: 'add' })}
          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Item
        </button>
      </div>

      {/* Search Bar */}
      {items.length > 10 && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 pb-4">
        <div className="flex-1 overflow-auto">
          {paginatedItems.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              {searchTerm ? 'No matching items found' : 'No items yet'}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '80%' }} />
                  <col style={{ width: '100px' }} />
                </colgroup>
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Index</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Value</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedItems.map((item, idx) => {
                    const actualIndex = items.indexOf(item)
                    return (
                      <tr key={`${item}-${actualIndex}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {actualIndex}
                        </td>
                        <td className="py-2 px-3">
                          <div
                            className="font-mono text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-orange-500 dark:hover:text-orange-400"
                            title={item}
                            onClick={() => setEditModal({
                              isOpen: true,
                              type: 'edit',
                              index: actualIndex,
                              initialValue: item,
                            })}
                          >
                            {item || '<empty>'}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditModal({
                                isOpen: true,
                                type: 'edit',
                                index: actualIndex,
                                initialValue: item,
                              })}
                              className="p-1.5 text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(actualIndex, item)}
                              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {filteredItems.length} total · Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-2 py-1 text-xs rounded ${
                      currentPage === pageNum
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      <EditModal
        isOpen={editModal.isOpen}
        type={editModal.type}
        index={editModal.index}
        initialValue={editModal.initialValue}
        onClose={() => setEditModal({ isOpen: false, type: 'add' })}
        onSave={(value, direction, index) => {
          if (editModal.type === 'add' && direction) {
            handleAddItem(value, direction)
          } else if (editModal.type === 'edit') {
            handleUpdateItem(editModal.initialValue || '', value, index || 0)
          }
        }}
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