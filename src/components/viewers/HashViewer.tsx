import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Trash2, Edit2, Search, X, Copy, Check } from 'lucide-react'
import { formatDataForEdit } from '@/utils/formatter'
import CodeEditor from '@/components/CodeEditor'
import ConfirmDialog from '../ConfirmDialog'

interface HashField {
  field: string
  value: string
}

export interface HashViewerProps {
  connectionId: string | null
  keyName: string
}

interface EditModalProps {
  isOpen: boolean
  type: 'add' | 'edit'
  initialField?: string
  initialValue?: string
  onClose: () => void
  onSave: (field: string, value: string, originalField?: string) => void
}

function EditModal({ isOpen, type, initialField, initialValue, onClose, onSave }: EditModalProps) {
  const [field, setField] = useState('')
  const [value, setValue] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setField(initialField || '')
      const formattedValue = formatDataForEdit(initialValue)
      setValue(formattedValue)
    }
  }, [isOpen, initialField, initialValue])

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
      if (field.trim() && value) {
        onSave(field.trim(), value, initialField)
        onClose()
      }
      return
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {type === 'add' ? 'Add New Hash Field' : 'Edit Hash Field'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body - no overflow here, CodeEditor handles its own scroll */}
        <div className="p-6 space-y-4">
          {/* Field Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field Name
            </label>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="Enter field name..."
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Value Editor - fixed height container with internal scroll */}
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
              className="border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900/50 overflow-hidden flex flex-col"
              style={{ height: '320px' }}
           >
              <CodeEditor
                value={value}
                onChange={setValue}
                onKeyDown={handleKeyDown}
                placeholder="输入值..."
                className="h-full"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
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
                if (field.trim() && value) {
                  onSave(field.trim(), value, initialField)
                }
              }}
              disabled={!field.trim() || !value}
              className="px-4 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {type === 'add' ? '添加字段' : '更新字段'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HashViewer({ connectionId, keyName }: HashViewerProps) {
  const [fields, setFields] = useState<HashField[]>([])
  const [loading, setLoading] = useState(false)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    type: 'add' | 'edit'
    initialField?: string
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

  // Search and lazy loading state
  const [searchTerm, setSearchTerm] = useState('')
  const [visibleFields, setVisibleFields] = useState<HashField[]>([])
  const [visibleCount, setVisibleCount] = useState(50) // 单独状态记录需要显示的数量
  const [allFieldsLoaded, setAllFieldsLoaded] = useState(false)

  // 表格容器的 ref，用于滚动监听
  const tableContainerRef = React.useRef<HTMLDivElement>(null)
  const loadingMoreRef = React.useRef(false) // 防止重复加载

  useEffect(() => {
    loadKey()
  }, [connectionId, keyName])

  // 重置搜索和加载状态
  useEffect(() => {
    setVisibleFields([])
    setVisibleCount(50)
    setAllFieldsLoaded(false)
    loadingMoreRef.current = false
  }, [searchTerm, fields])

  // Filter fields based on search
  const filteredFields = useMemo(() => {
    if (!searchTerm) return fields

    const term = searchTerm.toLowerCase()
    return fields.filter(
      (f) =>
        f.field.toLowerCase().includes(term) ||
        f.value.toLowerCase().includes(term)
    )
  }, [fields, searchTerm])

  // 计算当前应该显示的数据
  useEffect(() => {
    if (filteredFields.length === 0) {
      setVisibleFields([])
      setAllFieldsLoaded(true)
      return
    }

    const currentVisible = filteredFields.slice(0, visibleCount)
    setVisibleFields(currentVisible)
    setAllFieldsLoaded(visibleCount >= filteredFields.length)

    // 加载完成后重置加载状态
    if (loadingMoreRef.current && visibleCount >= filteredFields.length) {
      loadingMoreRef.current = false
    }
  }, [filteredFields, visibleCount])

  // 滚动到底部自动加载更多
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (allFieldsLoaded || loadingMoreRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = container
      // 当滚动到接近底部时加载更多
      if (scrollHeight - scrollTop - clientHeight < 50) {
        loadingMoreRef.current = true
        setVisibleCount(prev => {
          const newVal = prev + 50
          // 短暂延迟后重置加载状态
          setTimeout(() => {
            loadingMoreRef.current = false
          }, 100)
          return newVal
        })
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [allFieldsLoaded])

  const loadKey = async () => {
    if (!connectionId || !keyName) return

    setLoading(true)
    setFields([])
    setVisibleFields([])
    setVisibleCount(50)
    setAllFieldsLoaded(false)
    loadingMoreRef.current = false

    try {
      if (window.electronAPI && window.electronAPI.redisGet) {
        const result = await window.electronAPI.redisGet(connectionId, keyName)

        if (result.success && result.data) {
          const data = result.data as Record<string, string>
          const entries = Object.entries(data)
          const allFields: HashField[] = entries.map(([field, value]) => ({
            field,
            value,
          }))
          setFields(allFields)

          // 先加载第一页数据，立即显示
          const firstBatch = allFields.slice(0, 50)
          setVisibleFields(firstBatch)
          setAllFieldsLoaded(allFields.length <= 50)
        }
      }
    } catch (error) {
      // Error already handled by UI state
    } finally {
      setLoading(false)
    }
  }

  // 加载更多数据
  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || allFieldsLoaded) return
    loadingMoreRef.current = true
    setVisibleCount(prev => prev + 50)

    // 短暂延迟后重置加载状态
    setTimeout(() => {
      loadingMoreRef.current = false
    }, 100)
  }, [allFieldsLoaded])

  const handleAddField = async (field: string, value: string) => {
    if (!connectionId || !keyName || !field.trim()) return

    try {
      const result = await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'hash',
        { field: field.trim(), value }
      )
      if (result.success) {
        setFields([...fields, { field: field.trim(), value }])
        setEditModal({ isOpen: false, type: 'add' })
      }
    } catch (error) {
      // Error already handled by UI state
    }
  }

  const handleUpdateField = async (originalField: string, newField: string, newValue: string) => {
    if (!connectionId || !keyName || !newField.trim()) return

    try {
      const result = await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'hash',
        { field: newField.trim(), value: newValue }
      )
      if (result.success) {
        setFields(
          fields.map((f) =>
            f.field === originalField ? { field: newField.trim(), value: newValue } : f
          )
        )
        setEditModal({ isOpen: false, type: 'add' })
      }
    } catch (error) {
      // Error already handled by UI state
    }
  }

  const handleDeleteField = async (field: string) => {
    console.log('[handleDeleteField] Starting deletion for field:', field)
    console.log('[handleDeleteField] connectionId:', connectionId, 'keyName:', keyName)

    if (!connectionId || !keyName) {
      console.error('[handleDeleteField] Missing connectionId or keyName')
      return
    }

    setDeleteConfirm({
      isOpen: true,
      callback: async () => {
        console.log('[handleDeleteField] Confirmed deletion, executing...')
        try {
          console.log('[handleDeleteField] Calling redisSet with:', {
            connectionId,
            keyName,
            type: 'hash',
            value: { action: 'deleteField', field }
          })

          if (!window.electronAPI || !window.electronAPI.redisSet) {
            console.error('[handleDeleteField] electronAPI.redisSet not available')
            return
          }

          const result = await window.electronAPI.redisSet(
            connectionId,
            keyName,
            'hash',
            { action: 'deleteField', field }
          )

          console.log('[handleDeleteField] redisSet result:', result)

          // Delete successful - reload data to ensure UI reflects actual Redis state
          console.log('[handleDeleteField] Reloading data...')
          await loadKey()
          console.log('[handleDeleteField] Data reloaded successfully')
        } catch (error) {
          console.error('[handleDeleteField] Failed to delete hash field:', error)
        }
      },
      title: 'Delete Hash Field',
      message: `Are you sure you want to delete field "${field}"?`,
    })
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
            {fields.length} field{fields.length !== 1 ? 's' : ''}
          </span>
          {filteredFields.length !== fields.length && filteredFields.length > 0 && (
            <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {filteredFields.length} filtered
            </span>
          )}
        </div>
        <button
          onClick={() => setEditModal({ isOpen: true, type: 'add' })}
          className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Field
        </button>
      </div>

      {/* Search Bar */}
      {fields.length > 10 && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search fields or values..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 pb-4">
        {visibleFields.length === 0 ? (
          <div className="flex-1 overflow-auto">
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              {searchTerm ? 'No matching fields found' : 'No fields yet'}
            </div>
          </div>
        ) : (
          <>
            {/* Fixed Header */}
            <div className="flex-0 border border-gray-200 dark:border-gray-700 rounded-t-lg overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '31.25%' }} />
                  <col style={{ width: '43.75%' }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left py-2.5 px-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Field</th>
                    <th className="text-left py-2.5 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Value</th>
                    <th className="text-center py-2.5 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Actions</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body */}
            <div ref={tableContainerRef} className="flex-1 overflow-auto border-l border-r border-gray-200 dark:border-gray-700">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '31.25%' }} />
                  <col style={{ width: '43.75%' }} />
                  <col style={{ width: '90px' }} />
                </colgroup>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleFields.map((f, index) => (
                    <tr key={f.field} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-2.5 px-2.5">
                        <div
                          className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title={f.field}
                        >
                          {f.field}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div
                          className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title={f.value}
                          onClick={() => setEditModal({
                            isOpen: true,
                            type: 'edit',
                            initialField: f.field,
                            initialValue: f.value,
                          })}
                        >
                          {f.value || '<empty>'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditModal({
                              isOpen: true,
                              type: 'edit',
                              initialField: f.field,
                              initialValue: f.value,
                            })}
                            className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteField(f.field)}
                            className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Load More / Pagination Info */}
        {!searchTerm && filteredFields.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {visibleFields.length} of {filteredFields.length} fields
              {allFieldsLoaded && ' · All loaded'}
            </div>
            {!allFieldsLoaded && (
              <button
                onClick={handleLoadMore}
                className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
              >
                Load More
              </button>
            )}
          </div>
        )}
      </div>

      <EditModal
        isOpen={editModal.isOpen}
        type={editModal.type}
        initialField={editModal.initialField}
        initialValue={editModal.initialValue}
        onClose={() => setEditModal({ isOpen: false, type: 'add' })}
        onSave={(field, value, originalField) => {
          if (editModal.type === 'add') {
            handleAddField(field, value)
          } else {
            handleUpdateField(originalField || '', field, value)
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