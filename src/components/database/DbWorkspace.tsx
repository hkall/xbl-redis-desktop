import React, { useState, useRef, useEffect } from 'react'
import {
  Play,
  Save,
  FileCode,
  Plus,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Table,
  Eye,
  Columns,
  Database,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Hash,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react'
import { useDbStore } from '@/store/dbStore'
import { QueryResult, QueryTab } from '@/types/database'
import { useTranslation } from '@/store/i18nStore'

// SQL 编辑器组件
function SqlEditor({
  sql,
  onChange,
  onExecute,
  executing,
}: {
  sql: string
  onChange: (sql: string) => void
  onExecute: () => void
  executing: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [lineNumbers, setLineNumbers] = useState<number[]>([1])

  useEffect(() => {
    const lines = sql.split('\n').length
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1))
  }, [sql])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onExecute()
    }

    // Tab 插入两个空格
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newSql = sql.substring(0, start) + '  ' + sql.substring(end)
        onChange(newSql)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
      }
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* 行号 */}
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 text-right py-3 px-2 select-none font-mono text-sm overflow-hidden">
        {lineNumbers.map((num) => (
          <div key={num} className="leading-6">
            {num}
          </div>
        ))}
      </div>

      {/* 编辑器 */}
      <textarea
        ref={textareaRef}
        value={sql}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('database.sqlPlaceholderHint')}
        className="flex-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm p-3 resize-none focus:outline-none leading-6"
        spellCheck={false}
        disabled={executing}
      />
    </div>
  )
}

// 数据表格组件
function DataGrid({
  result,
  loading,
}: {
  result: QueryResult | null | undefined
  loading: boolean
}) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500 text-sm">{t('database.executeQueryResult')}</p>
      </div>
    )
  }

  if (!result.success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
        <p className="text-red-500 text-sm text-center">{result.error}</p>
      </div>
    )
  }

  if (!result.data || result.data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {result.affectedRows !== undefined
            ? t('database.rowsAffectedMsg', { count: result.affectedRows })
            : result.rowCount === 0
            ? t('database.querySuccessNoData')
            : t('database.querySuccessful')}
        </p>
      </div>
    )
  }

  const columns = result.columns || []
  const data = result.data

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10">
          <tr>
            {/* 行号列 */}
            <th className="w-10 px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              #
            </th>
            {columns.map((col, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>{col}</span>
                  {result.columnTypes?.[i] && (
                    <span className="text-gray-400 dark:text-gray-500 font-normal">
                      ({result.columnTypes[i]})
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td className="px-2 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                {rowIndex + 1}
              </td>
              {row.map((cell, colIndex) => (
                <td
                  key={colIndex}
                  className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 font-mono"
                >
                  {formatCellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 格式化单元格值
function formatCellValue(value: any): React.ReactNode {
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
    return JSON.stringify(value)
  }
  const str = String(value)
  if (str.length > 200) {
    return str.substring(0, 200) + '...'
  }
  return str
}

// 执行信息组件
function ExecutionInfo({ result }: { result: QueryResult | null | undefined }) {
  const { t } = useTranslation()
  if (!result) return null

  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
      <div className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        <span>{result.executionTime}ms</span>
      </div>
      {result.rowCount !== undefined && (
        <div className="flex items-center gap-1">
          <Hash className="w-3.5 h-3.5" />
          <span>{result.rowCount} {t('database.rows')}</span>
        </div>
      )}
      {result.affectedRows !== undefined && (
        <div className="flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>{t('database.rowsAffectedMsg', { count: result.affectedRows })}</span>
        </div>
      )}
    </div>
  )
}

// 标签页组件
function QueryTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCreate,
}: {
  tabs: QueryTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer min-w-[120px] max-w-[200px] ${
              activeTabId === tab.id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelect(tab.id)}
          >
            <FileCode className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm truncate flex-1">{tab.name}</span>
            {tab.isModified && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
              }}
              className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onCreate}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        title={t('database.newQueryTitle')}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}

// 空状态
function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{t('database.selectConnectionQuery')}</p>
      <p className="text-gray-400 dark:text-gray-500 text-xs">
        {t('database.orCreateConnection')}
      </p>
    </div>
  )
}

export default function DbWorkspace() {
  const { t } = useTranslation()
  const {
    connections,
    activeConnectionId,
    activeDatabase,
    queryTabs,
    activeTabId,
    executing,
    currentResult,
    getActiveTab,
    createQueryTab,
    closeQueryTab,
    setActiveTab,
    updateTabSql,
    executeCurrentTab,
  } = useDbStore()

  const activeConnection = connections.find((c) => c.id === activeConnectionId)
  const activeTab = getActiveTab()

  // 自动创建标签页
  useEffect(() => {
    if (activeConnectionId && queryTabs.length === 0) {
      createQueryTab()
    }
  }, [activeConnectionId])

  if (!activeConnectionId || !activeConnection?.connected) {
    return <EmptyState />
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* 标签页 */}
      <QueryTabs
        tabs={queryTabs}
        activeTabId={activeTabId}
        onSelect={setActiveTab}
        onClose={closeQueryTab}
        onCreate={() => createQueryTab()}
      />

      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {/* 连接/数据库信息 */}
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Database className="w-4 h-4" />
            <span>{activeConnection.name}</span>
            {activeDatabase && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span>{activeDatabase}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 执行按钮 */}
          <button
            onClick={executeCurrentTab}
            disabled={executing || !activeTab?.sql.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t('database.execute')}
          </button>

          {/* 快捷键提示 */}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Ctrl</kbd>
            +
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Enter</kbd>
          </span>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* SQL 编辑器 */}
        <div className="flex-1 min-h-[150px] p-3 border-b border-gray-200 dark:border-gray-700">
          <SqlEditor
            sql={activeTab?.sql || ''}
            onChange={(sql) => activeTabId && updateTabSql(activeTabId, sql)}
            onExecute={executeCurrentTab}
            executing={executing}
          />
        </div>

        {/* 结果区域 */}
        <div className="flex-1 min-h-[200px] flex flex-col">
          <DataGrid result={activeTab?.result} loading={executing} />
          <ExecutionInfo result={activeTab?.result} />
        </div>
      </div>
    </div>
  )
}