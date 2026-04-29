import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Table,
  Columns,
  Info,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Loader2,
  AlertCircle,
  Key,
  Hash,
  X,
  Plus,
  Trash2,
  Check,
  Square,
  CheckSquare,
} from 'lucide-react'
import { useTranslation } from '@/store/i18nStore'

interface TableDetailProps {
  connectionId: string
  database: string
  table: string
  onClose?: () => void
}

// 格式化单元格值
function formatCellValue(value: any, maxLength: number = 50): React.ReactNode {
  if (value === null) {
    return <span className="text-gray-400 dark:text-gray-500 italic">NULL</span>
  }
  if (value === undefined) {
    return <span className="text-gray-400 dark:text-gray-500 italic">undefined</span>
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return <span className="text-blue-600 dark:text-blue-400">{value.toLocaleString()}</span>
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value)
    if (str.length > maxLength) {
      return <span title={str}>{str.substring(0, maxLength)}...</span>
    }
    return str
  }
  const str = String(value)
  if (str.length > maxLength) {
    return <span title={str}>{str.substring(0, maxLength)}...</span>
  }
  return str
}

// 数据视图组件 - 支持 CRUD 操作
function TableDataView({ connectionId, database, table }: { connectionId: string; database: string; table: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<any[][]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnInfo, setColumnInfo] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [jumpPage, setJumpPage] = useState('')

  // CRUD 状态
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [isAddingRow, setIsAddingRow] = useState(false)
  const [newRowData, setNewRowData] = useState<Record<string, any>>({})
  const [primaryKeyColumns, setPrimaryKeyColumns] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // 新增行 ref
  const newRowRef = useRef<HTMLTableRowElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  // 获取表结构和数据
  const loadData = async () => {
    setLoading(true)
    setError(null)
    setSelectedRows(new Set())
    setEditingCell(null)
    setIsAddingRow(false)
    try {
      // 获取表结构（用于主键信息）
      if (window.electronAPI?.dbGetTableStructure) {
        const structureResult = await window.electronAPI.dbGetTableStructure(connectionId, database, table)
        if (structureResult.success) {
          const cols = structureResult.columns || []
          setColumnInfo(cols)
          // 找出主键列
          const pkCols = cols.filter(c => c.keyType === 'PRI').map(c => c.name)
          setPrimaryKeyColumns(pkCols)
        }
      }

      // 获取数据
      if (window.electronAPI?.dbGetTableData) {
        const result = await window.electronAPI.dbGetTableData(connectionId, database, table, {
          page,
          pageSize
        })
        if (result.success) {
          const dataRows = Array.isArray(result.data) ? result.data : []
          const cols = Array.isArray(result.columns) ? result.columns : []
          setData(dataRows)
          setColumns(cols)
          setTotal(result.total || 0)
        } else {
          setError(result.error || 'Failed to load data')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [connectionId, database, table, page, pageSize])

  // 获取行的主键值
  const getPrimaryKeyForRow = useCallback((rowIndex: number): Record<string, any> | null => {
    if (primaryKeyColumns.length === 0) return null
    const rowArray = Array.isArray(data[rowIndex]) ? data[rowIndex] : []
    const pk: Record<string, any> = {}
    primaryKeyColumns.forEach(pkCol => {
      const colIndex = columns.indexOf(pkCol)
      if (colIndex >= 0) {
        pk[pkCol] = rowArray[colIndex]
      }
    })
    return pk
  }, [data, columns, primaryKeyColumns])

  // 选择行
  const toggleRowSelection = (rowIndex: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex)
    } else {
      newSelected.add(rowIndex)
    }
    setSelectedRows(newSelected)
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(data.map((_, i) => i)))
    }
  }

  // 开始编辑单元格
  const startEditCell = (rowIndex: number, colIndex: number) => {
    if (primaryKeyColumns.length === 0) return // 无主键不可编辑（无法定位行）
    // 移除主键列不可编辑的限制，允许编辑所有列
    const rowArray = Array.isArray(data[rowIndex]) ? data[rowIndex] : []
    const value = rowArray[colIndex]
    setEditValue(value === null ? '' : String(value))
    setEditingCell({ rowIndex, colIndex })
    setIsAddingRow(false)
  }

  // 双击单元格
  const handleCellDoubleClick = (rowIndex: number, colIndex: number) => {
    if (editingCell === null && !isAddingRow) {
      startEditCell(rowIndex, colIndex)
    }
  }

  // 保存单元格编辑
  const saveCellEdit = async () => {
    if (!editingCell) return
    setSaving(true)
    try {
      const { rowIndex, colIndex } = editingCell
      const col = columns[colIndex]
      const primaryKey = getPrimaryKeyForRow(rowIndex)
      if (!primaryKey) {
        setEditingCell(null)
        setSaving(false)
        return
      }

      // 准备更新数据
      const updateData: Record<string, any> = {}
      updateData[col] = editValue === '' ? null : editValue

      if (window.electronAPI?.dbUpdateRow) {
        const result = await window.electronAPI.dbUpdateRow(connectionId, database, table, primaryKey, updateData)
        if (result.success) {
          setEditingCell(null)
          setEditValue('')
          loadData()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 取消单元格编辑
  const cancelCellEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // 单元格键盘事件
  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveCellEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelCellEdit()
    }
  }

  // 开始新增行
  const startAddRow = () => {
    const newRow: Record<string, any> = {}
    columns.forEach(col => {
      newRow[col] = null
    })
    setNewRowData(newRow)
    setIsAddingRow(true)
    setEditingCell(null)
    setSelectedRows(new Set())
  }

  // 新增行时滚动到该行并聚焦
  useEffect(() => {
    if (isAddingRow && newRowRef.current) {
      // 滚动到新增行
      newRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // 聚焦第一个输入框
      setTimeout(() => {
        firstInputRef.current?.focus()
      }, 100)
    }
  }, [isAddingRow])

  // 保存新增
  const saveAdd = async () => {
    setSaving(true)
    try {
      // 过滤掉空的字段
      const filteredData: Record<string, any> = {}
      Object.keys(newRowData).forEach(key => {
        if (newRowData[key] !== null && newRowData[key] !== undefined && newRowData[key] !== '') {
          filteredData[key] = newRowData[key]
        }
      })

      if (window.electronAPI?.dbInsertRow) {
        const result = await window.electronAPI.dbInsertRow(connectionId, database, table, filteredData)
        if (result.success) {
          setIsAddingRow(false)
          setNewRowData({})
          loadData()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 取消新增
  const cancelAdd = () => {
    setIsAddingRow(false)
    setNewRowData({})
  }

  // 删除选中行
  const deleteSelectedRows = async () => {
    if (selectedRows.size === 0) return
    if (primaryKeyColumns.length === 0) {
      alert(t('database.noPrimaryKeyWarning'))
      return
    }

    setShowDeleteConfirm(true)
  }

  // 确认删除
  const confirmDelete = async () => {
    setSaving(true)
    setShowDeleteConfirm(false)
    try {
      const primaryKeys: Record<string, any>[] = []
      selectedRows.forEach(rowIndex => {
        const pk = getPrimaryKeyForRow(rowIndex)
        if (pk) {
          primaryKeys.push(pk)
        }
      })

      if (window.electronAPI?.dbDeleteRows) {
        const result = await window.electronAPI.dbDeleteRows(connectionId, database, table, primaryKeys)
        if (result.success) {
          setSelectedRows(new Set())
          loadData()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const handleJumpPage = () => {
    const p = parseInt(jumpPage, 10)
    if (p >= 1 && p <= totalPages) {
      setPage(p)
      setJumpPage('')
    }
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(1)
  }

  // 新增单元格输入变化
  const handleNewRowChange = (col: string, value: any) => {
    setNewRowData(prev => ({ ...prev, [col]: value }))
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-500 text-sm text-center">{error}</p>
        <button
          onClick={loadData}
          className="mt-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {t('common.refresh')}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* 新增按钮 */}
          <button
            onClick={startAddRow}
            disabled={isAddingRow || editingCell !== null}
            className="flex items-center gap-1 px-2 py-1 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('database.addRow')}
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* 删除按钮 */}
          <button
            onClick={deleteSelectedRows}
            disabled={selectedRows.size === 0 || editingCell !== null || isAddingRow || primaryKeyColumns.length === 0}
            className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('database.deleteSelectedRows')}
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* 编辑时的保存/取消按钮 */}
          {editingCell && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={saveCellEdit}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t('common.save')}
              </button>
              <button
                onClick={cancelCellEdit}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded"
              >
                <X className="w-3 h-3" />
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* 分隔线 */}
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('database.rows')}: <span className="font-medium text-gray-700 dark:text-gray-300">{total.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{t('common.page')}:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-900 dark:text-gray-100"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* 新增行的保存/取消按钮 */}
          {isAddingRow && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={saveAdd}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t('common.save')}
              </button>
              <button
                onClick={cancelAdd}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded"
              >
                <X className="w-3 h-3" />
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={loadData}
          disabled={saving}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
          title={t('common.refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 主键提示 */}
      {primaryKeyColumns.length === 0 && columns.length > 0 && (
        <div className="flex-shrink-0 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-xs border-b border-yellow-200 dark:border-yellow-800">
          <AlertCircle className="w-3 h-3 inline mr-1" />
          {t('database.noPrimaryKeyWarning')}
        </div>
      )}

      {/* 数据表格 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {columns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            {t('database.noData')}
          </div>
        ) : (
          <table className="border-collapse w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                {/* 选择列 */}
                <th className="w-8 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 sticky left-0 z-20">
                  <button
                    onClick={toggleSelectAll}
                    className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    {selectedRows.size === data.length && data.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                </th>
                {/* 行号列 */}
                <th className="w-10 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 sticky left-8 z-20">
                  #
                </th>
                {columns.map((col, i) => {
                  const isPk = primaryKeyColumns.includes(col)
                  return (
                    <th
                      key={i}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap bg-gray-50 dark:bg-gray-900 min-w-[100px]"
                    >
                      <div className="flex items-center gap-1">
                        {isPk && <Key className="w-3 h-3 text-yellow-500" />}
                        <span>{col}</span>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => {
                const rowArray = Array.isArray(row) ? row : []
                const isSelected = selectedRows.has(rowIndex)

                return (
                  <tr
                    key={rowIndex}
                    className={isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
                  >
                    {/* 选择框 */}
                    <td className="w-8 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky left-0">
                      <button
                        onClick={() => toggleRowSelection(rowIndex)}
                        className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    {/* 行号 */}
                    <td className="w-10 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky left-8">
                      {(page - 1) * pageSize + rowIndex + 1}
                    </td>
                    {/* 数据列 */}
                    {columns.map((col, colIndex) => {
                      const value = rowArray[colIndex]
                      const isPk = primaryKeyColumns.includes(col)
                      const isEditing = editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex

                      return (
                        <td
                          key={colIndex}
                          className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 font-mono whitespace-nowrap max-w-[200px] min-w-[100px] cursor-pointer"
                          onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                          title={primaryKeyColumns.length > 0 ? t('database.doubleClickToEdit') : undefined}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleCellKeyDown}
                              onBlur={() => setTimeout(() => cancelCellEdit(), 150)}
                              placeholder="NULL"
                              autoFocus
                              className="w-full px-0 py-0.5 text-sm text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-blue-500 focus:outline-none"
                            />
                          ) : (
                            <span className="truncate block" title={String(value ?? '')}>
                              {formatCellValue(value)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* 新增行 */}
              {isAddingRow && (
                <tr ref={newRowRef} className="bg-green-50 dark:bg-green-900/20">
                  <td className="w-8 px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky left-0">
                    <span className="text-green-500 text-xs">{t('database.newRowLabel')}</span>
                  </td>
                  <td className="w-10 px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 sticky left-8">
                    *
                  </td>
                  {columns.map((col, colIndex) => {
                    const colInfo = columnInfo.find(c => c.name === col)
                    return (
                      <td
                        key={colIndex}
                        className="px-3 py-1.5 text-sm border-b border-gray-100 dark:border-gray-800"
                      >
                        <input
                          ref={colIndex === 0 ? firstInputRef : undefined}
                          type="text"
                          value={newRowData[col] ?? ''}
                          onChange={(e) => handleNewRowChange(col, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              saveAdd()
                            } else if (e.key === 'Escape') {
                              cancelAdd()
                            }
                          }}
                          placeholder={colInfo?.nullable ? 'NULL' : colInfo?.defaultValue || ''}
                          className="w-full px-1 py-0.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-transparent border-b border-green-400 dark:border-green-600 focus:outline-none focus:border-green-500"
                        />
                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('common.page')} {page} / {totalPages} ({((page - 1) * pageSize + 1)}-{Math.min(page * pageSize, total)} / {total})
            {selectedRows.size > 0 && (
              <span className="ml-2 text-blue-500">{t('database.selectedRowsCount', { count: selectedRows.size })}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              title={t('database.firstPage')}
            >
              <ChevronFirst className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              title={t('database.prevPage')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 mx-1">
              <input
                type="text"
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleJumpPage()}
                placeholder={String(page)}
                className="w-10 px-1 py-0.5 text-center text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleJumpPage}
                className="px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {t('database.jumpTo')}
              </button>
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              title={t('database.nextPage')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              title={t('database.lastPage')}
            >
              <ChevronLast className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{t('database.confirmDeleteTitle')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('database.confirmDeleteRowsMsg', { count: selectedRows.size })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 结构视图组件 - Navicat 风格（更流畅的交互）
function TableStructureView({ connectionId, database, table }: { connectionId: string; database: string; table: string }) {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [columns, setColumns] = useState<any[]>([])
  const [indexes, setIndexes] = useState<any[]>([])
  const [createStatement, setCreateStatement] = useState('')
  const [activeView, setActiveView] = useState<'columns' | 'indexes' | 'ddl'>('columns')

  // 编辑状态 - 单元格级别编辑（类似表数据）
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: 'column' | 'index'; index: number | string } | null>(null)

  // refs
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadStructure = async () => {
    setLoading(true)
    setError(null)
    setEditingCell(null)
    try {
      if (window.electronAPI?.dbGetTableStructure) {
        const result = await window.electronAPI.dbGetTableStructure(connectionId, database, table)
        if (result.success) {
          setColumns(result.columns || [])
          setIndexes(result.indexes || [])
          setCreateStatement(result.createStatement || '')
        } else {
          setError(result.error || 'Failed to load structure')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStructure()
  }, [connectionId, database, table])

  // 双击单元格进入编辑
  const startEditCell = (rowIndex: number, field: string) => {
    const col = columns[rowIndex]
    if (!col) return

    // 获取当前值
    let value = ''
    if (field === 'name') value = col.name || ''
    else if (field === 'type') value = col.type || ''
    else if (field === 'defaultValue') value = col.defaultValue !== null ? String(col.defaultValue) : ''
    else if (field === 'comment') value = col.comment || ''

    setEditValue(value)
    setEditingCell({ rowIndex, field })
  }

  // 保存单元格编辑
  const saveCellEdit = async () => {
    if (!editingCell) return
    const { rowIndex, field } = editingCell
    const col = columns[rowIndex]
    if (!col) return

    // 构建新的列数据
    const newData = {
      name: field === 'name' ? editValue : col.name,
      type: field === 'type' ? editValue : col.type,
      nullable: col.nullable,
      defaultValue: field === 'defaultValue' ? editValue : col.defaultValue,
      extra: col.extra || '',
      comment: field === 'comment' ? editValue : col.comment,
    }

    // 检查是否有变化
    const hasChange =
      (field === 'name' && newData.name !== col.name) ||
      (field === 'type' && newData.type !== col.type) ||
      (field === 'defaultValue' && newData.defaultValue !== col.defaultValue) ||
      (field === 'comment' && newData.comment !== col.comment)

    if (!hasChange) {
      setEditingCell(null)
      setEditValue('')
      return
    }

    // 新列必须有名称
    if (col.isNew && !newData.name?.trim()) {
      setEditingCell(null)
      setEditValue('')
      return
    }

    setSaving(true)
    try {
      let sql: string

      if (col.isNew) {
        sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${newData.name}\` ${newData.type}`
        if (!newData.nullable) sql += ' NOT NULL'
        if (newData.defaultValue) {
          if (newData.defaultValue.toUpperCase() === 'NULL') {
            sql += ' DEFAULT NULL'
          } else {
            sql += ` DEFAULT '${newData.defaultValue}'`
          }
        }
        if (newData.comment) sql += ` COMMENT '${newData.comment}'`
      } else {
        sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`${newData.name}\` ${newData.type}`
        if (!newData.nullable) sql += ' NOT NULL'
        if (newData.defaultValue) {
          if (newData.defaultValue.toUpperCase() === 'NULL') {
            sql += ' DEFAULT NULL'
          } else {
            sql += ` DEFAULT '${newData.defaultValue}'`
          }
        }
        if (newData.extra) sql += ` ${newData.extra}`
        if (newData.comment) sql += ` COMMENT '${newData.comment}'`
      }

      if (window.electronAPI?.dbExecuteQuery) {
        const result = await window.electronAPI.dbExecuteQuery(connectionId, sql, database)
        if (result.success) {
          setEditingCell(null)
          setEditValue('')
          loadStructure()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 取消编辑（不删除新列）
  const cancelCellEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // 切换Nullable
  const toggleNullable = async (rowIndex: number) => {
    const col = columns[rowIndex]
    if (!col) return

    // 构建新的列数据
    const newData = {
      name: col.name,
      type: col.type,
      nullable: !col.nullable,
      defaultValue: col.defaultValue,
      extra: col.extra || '',
      comment: col.comment,
    }

    setSaving(true)
    try {
      let sql: string

      if (col.isNew) {
        sql = `ALTER TABLE \`${table}\` ADD COLUMN \`${newData.name}\` ${newData.type}`
        if (!newData.nullable) sql += ' NOT NULL'
        if (newData.defaultValue) {
          if (String(newData.defaultValue).toUpperCase() === 'NULL') {
            sql += ' DEFAULT NULL'
          } else {
            sql += ` DEFAULT '${newData.defaultValue}'`
          }
        }
        if (newData.comment) sql += ` COMMENT '${newData.comment}'`
      } else {
        sql = `ALTER TABLE \`${table}\` MODIFY COLUMN \`${newData.name}\` ${newData.type}`
        if (!newData.nullable) sql += ' NOT NULL'
        if (newData.defaultValue) {
          if (String(newData.defaultValue).toUpperCase() === 'NULL') {
            sql += ' DEFAULT NULL'
          } else {
            sql += ` DEFAULT '${newData.defaultValue}'`
          }
        }
        if (newData.extra) sql += ` ${newData.extra}`
        if (newData.comment) sql += ` COMMENT '${newData.comment}'`
      }

      if (window.electronAPI?.dbExecuteQuery) {
        const result = await window.electronAPI.dbExecuteQuery(connectionId, sql, database)
        if (result.success) {
          loadStructure()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 键盘事件处理（和表数据一样）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveCellEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelCellEdit()
    }
  }

  // 添加新列
  const handleAddColumn = () => {
    const newCol = {
      name: '',
      type: 'VARCHAR(255)',
      nullable: true,
      defaultValue: '',
      extra: '',
      comment: '',
      keyType: null,
      isNew: true
    }
    const newColumns = [...columns, newCol]
    setColumns(newColumns)
    // 直接进入编辑name字段
    startEditCell(newColumns.length - 1, 'name')
  }

  // 删除列
  const handleDeleteColumn = async (index: number) => {
    const col = columns[index]
    if (!col || col.isNew) {
      // 直接移除新添加的行
      setColumns(columns.filter((_, i) => i !== index))
      setShowDeleteConfirm(null)
      return
    }

    setSaving(true)
    try {
      const sql = `ALTER TABLE \`${table}\` DROP COLUMN \`${col.name}\``
      if (window.electronAPI?.dbExecuteQuery) {
        const result = await window.electronAPI.dbExecuteQuery(connectionId, sql, database)
        if (result.success) {
          setShowDeleteConfirm(null)
          loadStructure()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 删除索引
  const handleDeleteIndex = async (indexName: string) => {
    setSaving(true)
    try {
      let sql = indexName === 'PRIMARY'
        ? `ALTER TABLE \`${table}\` DROP PRIMARY KEY`
        : `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``

      if (window.electronAPI?.dbExecuteQuery) {
        const result = await window.electronAPI.dbExecuteQuery(connectionId, sql, database)
        if (result.success) {
          setShowDeleteConfirm(null)
          loadStructure()
        } else {
          alert(result.error || t('common.error'))
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-500 text-sm text-center">{error}</p>
        <button
          onClick={loadStructure}
          className="mt-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          {t('common.refresh')}
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col min-h-0">
      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('columns')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeView === 'columns'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('database.columnsTab')} ({columns.filter(c => !c.isNew).length})
          </button>
          <button
            onClick={() => setActiveView('indexes')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeView === 'indexes'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t('database.indexesTab')} ({indexes.length})
          </button>
          <button
            onClick={() => setActiveView('ddl')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeView === 'ddl'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            DDL
          </button>

          {/* 编辑时的保存/取消按钮 */}
          {activeView === 'columns' && editingCell !== null && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={saveCellEdit}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t('common.save')}
              </button>
              <button
                onClick={cancelCellEdit}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* 添加列按钮 */}
          {activeView === 'columns' && editingCell === null && (
            <button
              onClick={handleAddColumn}
              className="flex items-center gap-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('database.addColumn')}
            </button>
          )}
        </div>
        <button
          onClick={loadStructure}
          disabled={saving}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title={t('common.refresh')}
        >
          <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto">
        {/* 列信息 */}
        {activeView === 'columns' && (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10">
              <tr>
                <th className="w-10 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[120px]">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[140px]">{t('common.type')}</th>
                <th className="w-14 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Null</th>
                <th className="w-14 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Key</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[80px]">Default</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-24">Extra</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[120px]">Comment</th>
                <th className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const isNew = col.isNew

                return (
                  <tr
                    key={i}
                    className={`transition-colors ${
                      isNew
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                      {isNew ? (
                        <span className="text-green-500 font-medium">*</span>
                      ) : (
                        i + 1
                      )}
                    </td>
                    {/* Name */}
                    <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 relative">
                      {editingCell?.rowIndex === i && editingCell?.field === 'name' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t('database.columnNamePlaceholder')}
                          autoFocus
                          className="absolute inset-0 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-0 border-b-2 border-blue-500 focus:outline-none z-10"
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditCell(i, 'name')}
                          className="flex items-center gap-1.5 min-h-[28px] cursor-pointer"
                          title={t('database.doubleClickToEdit')}
                        >
                          {col.keyType === 'PRI' && <Key className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />}
                          {col.keyType === 'UNI' && <Hash className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{col.name}</span>
                        </div>
                      )}
                    </td>
                    {/* Type */}
                    <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 relative">
                      {editingCell?.rowIndex === i && editingCell?.field === 'type' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="VARCHAR(255)"
                          autoFocus
                          className="absolute inset-0 px-2 py-1.5 text-xs font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-0 border-b-2 border-blue-500 focus:outline-none z-10"
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditCell(i, 'type')}
                          className="min-h-[28px] cursor-pointer"
                          title={t('database.doubleClickToEdit')}
                        >
                          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">{col.type}</span>
                        </div>
                      )}
                    </td>
                    {/* Null */}
                    <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
                      <button
                        onClick={() => toggleNullable(i)}
                        disabled={saving}
                        className={`text-xs px-1.5 py-0.5 rounded inline-block cursor-pointer hover:opacity-80 transition-opacity ${
                          col.nullable
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        }`}
                        title={t('database.clickToToggle')}
                      >
                        {col.nullable ? 'Y' : 'N'}
                      </button>
                    </td>
                    {/* Key */}
                    <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{col.keyType || '-'}</span>
                    </td>
                    {/* Default */}
                    <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 relative">
                      {editingCell?.rowIndex === i && editingCell?.field === 'defaultValue' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="NULL"
                          autoFocus
                          className="absolute inset-0 px-2 py-1.5 text-xs font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-0 border-b-2 border-blue-500 focus:outline-none z-10"
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditCell(i, 'defaultValue')}
                          className="min-h-[28px] cursor-pointer"
                          title={t('database.doubleClickToEdit')}
                        >
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                            {col.defaultValue !== null ? String(col.defaultValue) : <span className="text-gray-400 italic">NULL</span>}
                          </span>
                        </div>
                      )}
                    </td>
                    {/* Extra */}
                    <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{col.extra || '-'}</span>
                    </td>
                    {/* Comment */}
                    <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800 relative">
                      {editingCell?.rowIndex === i && editingCell?.field === 'comment' ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={t('database.columnCommentPlaceholder')}
                          autoFocus
                          className="absolute inset-0 px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-0 border-b-2 border-blue-500 focus:outline-none z-10"
                        />
                      ) : (
                        <div
                          onDoubleClick={() => startEditCell(i, 'comment')}
                          className="min-h-[28px] cursor-pointer"
                          title={t('database.doubleClickToEdit')}
                        >
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={col.comment}>{col.comment || '-'}</span>
                        </div>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
                      {!isNew && col.keyType !== 'PRI' && (
                        <button
                          onClick={() => setShowDeleteConfirm({ type: 'column', index: i })}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* 索引信息 */}
        {activeView === 'indexes' && (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10">
              <tr>
                <th className="w-10 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[150px]">{t('common.name')}</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 min-w-[200px]">Columns</th>
                <th className="w-14 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">Unique</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 w-24">{t('common.type')}</th>
                <th className="w-16 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700"></th>
              </tr>
            </thead>
            <tbody>
              {indexes.map((idx, i) => (
                <tr
                  key={i}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">{i + 1}</td>
                  <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5">
                      {idx.name === 'PRIMARY' && <Key className="w-3.5 h-3.5 text-yellow-500" />}
                      <span className="text-sm text-gray-700 dark:text-gray-300">{idx.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-600 dark:text-gray-400">{idx.columns?.join(', ')}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      idx.unique
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {idx.unique ? 'Y' : 'N'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{idx.type}</span>
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-gray-100 dark:border-gray-800">
                    {idx.name !== 'PRIMARY' && (
                      <button
                        onClick={() => setShowDeleteConfirm({ type: 'index', index: idx.name })}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* DDL */}
        {activeView === 'ddl' && (
          <div className="p-4">
            <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre font-mono border border-gray-200 dark:border-gray-700">
              {createStatement}
            </pre>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm mx-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {showDeleteConfirm.type === 'column'
                ? t('database.confirmDeleteColumnTitle')
                : t('database.confirmDeleteIndexTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {showDeleteConfirm.type === 'column'
                ? t('database.confirmDeleteColumnMsg', { name: columns[showDeleteConfirm.index as number]?.name })
                : t('database.confirmDeleteIndexMsg', { name: showDeleteConfirm.index })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  if (showDeleteConfirm.type === 'column') {
                    handleDeleteColumn(showDeleteConfirm.index as number)
                  } else {
                    handleDeleteIndex(showDeleteConfirm.index as string)
                  }
                }}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50"
              >
                {saving ? t('database.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 信息视图组件
function TableInfoView({ connectionId, database, table }: { connectionId: string; database: string; table: string }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<any>({})

  const loadInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI?.dbGetTableStructure) {
        const result = await window.electronAPI.dbGetTableStructure(connectionId, database, table)
        if (result.success) {
          setInfo({
            columns: result.columns?.length || 0,
            indexes: result.indexes?.length || 0,
            createStatement: result.createStatement
          })
        } else {
          setError(result.error || 'Failed to load info')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInfo()
  }, [connectionId, database, table])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-500 text-sm text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('database.columnsCount')}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{info.columns}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('database.indexesCount')}</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{info.indexes}</div>
            </div>
          </div>

          {info.createStatement && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('database.createTable')}</h3>
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
                {info.createStatement}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TableDetail({ connectionId, database, table, onClose }: TableDetailProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'data' | 'structure' | 'info'>('data')

  const tabs = [
    { id: 'data' as const, label: t('database.dataTab'), icon: Table },
    { id: 'structure' as const, label: t('database.structureTab'), icon: Columns },
    { id: 'info' as const, label: t('database.infoTab'), icon: Info },
  ]

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-gray-900 dark:text-white">{table}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{database}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'data' && (
          <TableDataView connectionId={connectionId} database={database} table={table} />
        )}
        {activeTab === 'structure' && (
          <TableStructureView connectionId={connectionId} database={database} table={table} />
        )}
        {activeTab === 'info' && (
          <TableInfoView connectionId={connectionId} database={database} table={table} />
        )}
      </div>
    </div>
  )
}