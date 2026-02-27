import React, { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Edit2, Search, X, Copy, Check } from 'lucide-react'
import { formatDataForEdit } from '@/utils/formatter'
import CodeEditor from '@/components/CodeEditor'
import ConfirmDialog from '../ConfirmDialog'

export interface ZSetMember {
  member: string
  score: number
}

export interface ZSetViewerProps {
  connectionId: string | null
  keyName: string
}

interface EditModalProps {
  isOpen: boolean
  type: 'add' | 'edit'
  rank?: number
  initialMember?: string
  initialScore?: number
  onClose: () => void
  onSave: (member: string, score: number, originalMember?: string) => void
}

function EditModal({ isOpen, type, rank, initialMember, initialScore, onClose, onSave }: EditModalProps) {
  const [member, setMember] = useState('')
  const [score, setScore] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const formattedValue = formatDataForEdit(initialMember)
      setMember(formattedValue)
      setScore(initialScore ?? 0)
    }
  }, [isOpen, initialMember, initialScore])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(member)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Error already handled by UI state
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = member.substring(0, start) + '  ' + member.substring(end)
      setMember(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (member.trim()) {
        onSave(member.trim(), score, initialMember)
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
            {type === 'add' ? 'Add New ZSet Member' : 'Edit ZSet Member'}
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
          {/* Score Input */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              分数
            </label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
              step={0.01}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Member Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                {type === 'add' ? '新成员值' : '成员值'}
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
                value={member}
                onChange={setMember}
                onKeyDown={handleKeyDown}
                placeholder="输入成员值..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {member.length} 字符 · Tab 缩进 · Ctrl+Enter 保存
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
                if (member.trim()) {
                  onSave(member.trim(), score, initialMember)
                }
              }}
              disabled={!member.trim()}
              className="px-4 py-2 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {type === 'add' ? '添加成员' : '更新成员'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ITEMS_PER_PAGE = 20

export default function ZSetViewer({ connectionId, keyName }: ZSetViewerProps) {
  const [members, setMembers] = useState<ZSetMember[]>([])
  const [loading, setLoading] = useState(false)
  const [editModal, setEditModal] = useState<{
    isOpen: boolean
    type: 'add' | 'edit'
    rank?: number
    initialMember?: string
    initialScore?: number
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

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!searchTerm) return members

    const term = searchTerm.toLowerCase()
    return members.filter(
      (m) =>
        m.member.toLowerCase().includes(term) ||
        String(m.score).includes(term)
    )
  }, [members, searchTerm])

  // Pagination with useMemo for performance
  const { paginatedMembers, totalPages } = useMemo(() => {
    const total = Math.ceil(filteredMembers.length / ITEMS_PER_PAGE)
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return {
      paginatedMembers: filteredMembers.slice(start, end),
      totalPages: total
    }
  }, [filteredMembers, currentPage, ITEMS_PER_PAGE])

  const loadKey = async () => {
    if (!connectionId || !keyName) return

    setLoading(true)
    setMembers([])

    try {
      if (window.electronAPI && window.electronAPI.redisGet) {
        const result = await window.electronAPI.redisGet(connectionId, keyName)

        if (result.success && result.data) {
          const data = result.data as ZSetMember[]
          requestAnimationFrame(() => {
            setMembers(data)
          })
        }
      }
    } catch (error) {
      // Error already handled by UI state
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (member: string, score: number) => {
    if (!connectionId || !keyName || !member) return

    try {
      const result = await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'zset',
        { action: 'add', score, member }
      )
      if (result.success) {
        setMembers([...members, { member, score }])
        setEditModal({ isOpen: false, type: 'add' })
      }
    } catch (error) {
      // Error already handled by UI state
    }
  }

  const handleDeleteMember = async (member: string) => {
    if (!connectionId || !keyName) return
    setDeleteConfirm({
      isOpen: true,
      callback: async () => {
        try {
          await window.electronAPI.redisSet(
            connectionId,
            keyName,
            'zset',
            { action: 'remove', member }
          )
          setMembers(members.filter((m) => m.member !== member))
        } catch (error) {
          // Error already handled by UI state
        }
      },
      title: 'Delete ZSet Member',
      message: `Are you sure you want to delete member "${member}"?`,
    })
  }

  const handleUpdateMember = async (originalMember: string, newMember: string, newScore: number) => {
    if (!connectionId || !keyName || originalMember === newMember) return

    try {
      await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'zset',
        { action: 'remove', member: originalMember }
      )
      await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'zset',
        { action: 'update', score: newScore, member: newMember }
      )
      setMembers(
        members.map((m) =>
          m.member === originalMember ? { member: newMember, score: newScore } : m
        )
      )
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
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          {filteredMembers.length !== members.length && filteredMembers.length > 0 && (
            <span className="text-[11px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
              {filteredMembers.length} filtered
            </span>
          )}
        </div>
        <button
          onClick={() => setEditModal({ isOpen: true, type: 'add' })}
          className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Member
        </button>
      </div>

      {/* Search Bar */}
      {members.length > 10 && (
        <div className="flex-shrink-0 px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search members or scores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col px-4 pb-4">
        <div className="flex-1 overflow-auto">
          {paginatedMembers.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs">
              {searchTerm ? 'No matching members found' : 'No members yet'}
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '60px' }} />
                  <col style={{ width: 'calc(100% - 220px)' }} />
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '100px' }} />
                </colgroup>
                <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Rank</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Member</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Score</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedMembers.map((m, idx) => (
                    <tr key={m.member} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 px-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <div
                          className="font-mono text-xs text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-500 dark:hover:text-blue-400"
                          title={m.member}
                          onClick={() => setEditModal({
                            isOpen: true,
                            type: 'edit',
                            rank: idx + 1,
                            initialMember: m.member,
                            initialScore: m.score,
                          })}
                        >
                          {m.member || '<empty>'}
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-gray-700 dark:text-gray-300 text-right">
                        {m.score.toFixed(2)}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditModal({
                              isOpen: true,
                              type: 'edit',
                              rank: idx + 1,
                              initialMember: m.member,
                              initialScore: m.score,
                            })}
                            className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(m.member)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
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
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {filteredMembers.length} total · Page {currentPage} of {totalPages}
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
                        ? 'bg-purple-500 text-white'
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
        rank={editModal.rank}
        initialMember={editModal.initialMember}
        initialScore={editModal.initialScore}
        onClose={() => setEditModal({ isOpen: false, type: 'add' })}
        onSave={(member, score, originalMember) => {
          if (editModal.type === 'add') {
            handleAddMember(member, score)
          } else {
            handleUpdateMember(originalMember || '', member, score)
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