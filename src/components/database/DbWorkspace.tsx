import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Play,
  Save,
  FileCode,
  Plus,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronFirst,
  ChevronLast,
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
  Info,
  Key,
  Bolt,
} from 'lucide-react'
import { useDbStore } from '@/store/dbStore'
import { QueryResult, UnifiedTab, TableInfo, ColumnInfo } from '@/types/database'
import { useTranslation } from '@/store/i18nStore'
import TableDetail from './TableDetail'
import ProcedureDetail from './ProcedureDetail'
import TriggerDetail from './TriggerDetail'

// SQL 关键字列表
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
  'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'PROCEDURE', 'FUNCTION', 'TRIGGER',
  'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'AS',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'CROSS',
  'GROUP', 'BY', 'HAVING', 'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
  'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
  'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
  'VALUES', 'SET', 'INTO', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
  'AUTO_INCREMENT', 'DEFAULT', 'NOT NULL', 'UNIQUE', 'CHECK',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
  'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'BOOLEAN', 'BOOL',
  'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'ENUM', 'SET',
  'IF', 'ELSE', 'THEN', 'END', 'CASE', 'WHEN',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'START', 'TRANSACTION',
  'SHOW', 'DESCRIBE', 'DESC', 'USE', 'EXPLAIN',
  'GRANT', 'REVOKE', 'PRIVILEGES', 'TO',
  'ENGINE', 'CHARSET', 'COLLATE', 'COMMENT',
]

// 内置函数
const SQL_FUNCTIONS = [
  'NOW()', 'DATE()', 'TIME()', 'YEAR()', 'MONTH()', 'DAY()', 'HOUR()', 'MINUTE()', 'SECOND()',
  'CONCAT()', 'SUBSTRING()', 'LENGTH()', 'CHAR_LENGTH()', 'TRIM()', 'LTRIM()', 'RTRIM()',
  'UPPER()', 'LOWER()', 'REPLACE()', 'FORMAT()', 'ROUND()', 'FLOOR()', 'CEIL()', 'ABS()',
  'IFNULL()', 'COALESCE()', 'NULLIF()', 'CAST()', 'CONVERT()',
  'UUID()', 'RAND()', 'MD5()', 'SHA1()', 'SHA2()',
  'LAST_INSERT_ID()', 'COUNT()', 'SUM()', 'AVG()', 'MAX()', 'MIN()',
  'GROUP_CONCAT()', 'JSON_OBJECT()', 'JSON_ARRAY()', 'JSON_EXTRACT()',
]

// 可拖拽分割器
function ResizableDivider({
  onResize,
}: {
  onResize: (delta: number) => void
}) {
  const isDragging = useRef(false)
  const startY = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = e.clientY - startY.current  // 向下移动增加高度
      startY.current = e.clientY
      onResize(delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return (
    <div
      className="h-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500 cursor-row-resize flex items-center justify-center transition-colors group"
      onMouseDown={handleMouseDown}
    >
      <div className="w-8 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-white transition-colors" />
    </div>
  )
}

// 自动补全项
interface SuggestionItem {
  label: string
  type: 'keyword' | 'function' | 'database' | 'table' | 'column'
  detail?: string
}

// SQL 编辑器组件（带自动补全）
function SqlEditor({
  sql,
  onChange,
  onExecute,
  executing,
  connectionId,
  database,
}: {
  sql: string
  onChange: (sql: string) => void
  onExecute: () => void
  executing: boolean
  connectionId: string
  database: string | null
}) {
  const { t } = useTranslation()
  const { getCachedTables, getCachedColumns, getCachedDatabases } = useDbStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [lineNumbers, setLineNumbers] = useState<number[]>([1])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [filteredSuggestions, setFilteredSuggestions] = useState<SuggestionItem[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const [currentWord, setCurrentWord] = useState('')
  const [wordStartPos, setWordStartPos] = useState(0)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const suggestionItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const isSelectingRef = useRef(false) // 标记是否正在选择

  // 获取所有可能的建议
  const allSuggestions = useCallback(() => {
    const itemsMap = new Map<string, SuggestionItem>()

    // 关键字（优先级最高）
    SQL_KEYWORDS.forEach(kw => {
      if (!itemsMap.has(kw)) {
        itemsMap.set(kw, { label: kw, type: 'keyword', detail: t('database.keyword') })
      }
    })

    // 函数
    SQL_FUNCTIONS.forEach(fn => {
      if (!itemsMap.has(fn)) {
        itemsMap.set(fn, { label: fn, type: 'function', detail: t('database.function') })
      }
    })

    // 数据库名
    const databases = getCachedDatabases(connectionId) || []
    databases.forEach(db => {
      if (!itemsMap.has(db.name)) {
        itemsMap.set(db.name, { label: db.name, type: 'database', detail: `${db.tableCount || 0} ${t('database.tables')}` })
      }
    })

    // 表名
    if (database) {
      const tables = getCachedTables(connectionId, database) || []
      tables.forEach(tbl => {
        if (!itemsMap.has(tbl.name)) {
          itemsMap.set(tbl.name, { label: tbl.name, type: 'table', detail: tbl.type || t('database.table') })
        }
        // 获取表的列名
        const columns = getCachedColumns(connectionId, database, tbl.name) || []
        columns.forEach(col => {
          if (!itemsMap.has(col.name)) {
            itemsMap.set(col.name, {
              label: col.name,
              type: 'column',
              detail: `${col.type || ''}${col.keyType === 'PRI' ? ' (PK)' : ''}`
            })
          }
        })
      })
    }

    return Array.from(itemsMap.values())
  }, [connectionId, database, getCachedDatabases, getCachedTables, getCachedColumns])

  useEffect(() => {
    const lines = sql.split('\n').length
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1))
  }, [sql])

  // 滚动到选中的建议项
  useEffect(() => {
    if (showSuggestions && suggestionItemRefs.current[selectedSuggestionIndex]) {
      suggestionItemRefs.current[selectedSuggestionIndex]?.scrollIntoView({
        block: 'nearest',
      })
    }
  }, [selectedSuggestionIndex, showSuggestions])

  // 计算光标位置的像素坐标
  const calculateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return { top: 0, left: 0 }

    const text = textarea.value
    const cursorPos = textarea.selectionStart

    // 计算行号和列位置
    const lines = text.substring(0, cursorPos).split('\n')
    const currentLineNumber = lines.length
    const currentColumn = lines[lines.length - 1].length

    // 创建临时元素计算位置
    const mirror = document.createElement('div')
    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: ${textarea.style.fontFamily || 'monospace'};
      font-size: ${textarea.style.fontSize || '14px'};
      line-height: ${textarea.style.lineHeight || '24px'};
      padding: ${textarea.style.padding || '12px'};
      width: ${textarea.clientWidth}px`;

    document.body.appendChild(mirror)

    // 添加文本直到光标位置
    lines.forEach((line, i) => {
      const lineSpan = document.createElement('span')
      lineSpan.textContent = line
      mirror.appendChild(lineSpan)
      if (i < lines.length - 1) {
        mirror.appendChild(document.createElement('br'))
      }
    })

    // 添加光标标记
    const cursorSpan = document.createElement('span')
    cursorSpan.textContent = '|'
    mirror.appendChild(cursorSpan)

    const cursorRect = cursorSpan.getBoundingClientRect()
    const textareaRect = textarea.getBoundingClientRect()

    document.body.removeChild(mirror)

    return {
      top: textareaRect.top + cursorSpan.offsetTop - textarea.scrollTop + 24,
      left: textareaRect.left + 10 + currentColumn * 8 // 简化计算
    }
  }, [])

  // 获取当前正在输入的单词
  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    let start = cursorPos
    while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) {
      start--
    }
    let end = cursorPos
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
      end++
    }
    return {
      word: text.substring(start, end),
      start,
      end
    }
  }, [])

  // 分析上下文以优化建议
  const analyzeContext = useCallback((text: string, cursorPos: number) => {
    // 获取光标前的文本
    const textBeforeCursor = text.substring(0, cursorPos).toUpperCase()

    // 检查是否在 FROM 或 JOIN 后面（应该推荐表名）
    if (/(FROM|JOIN)\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) {
      return 'table'
    }

    // 检查是否在 SELECT 后面（可能推荐列名或函数）
    if (/SELECT\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor) ||
        /SELECT\s+[^,]+\s*,\s*[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) {
      return 'column-or-function'
    }

    // 检查是否在 USE 后面（推荐数据库名）
    if (/USE\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) {
      return 'database'
    }

    // 检查是否在 WHERE 后面（推荐列名）
    if (/WHERE\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor) ||
        /(AND|OR)\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) {
      return 'column'
    }

    return 'any'
  }, [])

  // 处理输入变化，触发补全
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSql = e.target.value
    onChange(newSql)

    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const { word, start } = getCurrentWord(newSql, cursorPos)
    setCurrentWord(word)
    setWordStartPos(start)

    if (word.length >= 1) {
      // 获取上下文类型
      const contextType = analyzeContext(newSql, cursorPos)
      const allItems = allSuggestions()

      // 根据上下文过滤建议
      let contextFiltered = allItems
      if (contextType === 'table') {
        contextFiltered = allItems.filter(s => s.type === 'table' || s.type === 'database')
      } else if (contextType === 'column') {
        contextFiltered = allItems.filter(s => s.type === 'column' || s.type === 'function')
      } else if (contextType === 'column-or-function') {
        contextFiltered = allItems.filter(s => s.type === 'column' || s.type === 'function' || s.type === 'keyword')
      } else if (contextType === 'database') {
        contextFiltered = allItems.filter(s => s.type === 'database')
      }

      // 根据输入过滤
      const wordLower = word.toLowerCase()
      const filtered = contextFiltered
        .filter(s => s.label.toLowerCase().startsWith(wordLower))
        .slice(0, 15) // 限制显示数量

      setFilteredSuggestions(filtered)
      setSelectedSuggestionIndex(0)
      setShowSuggestions(filtered.length > 0)

      // 计算位置
      const pos = calculateCursorPosition()
      setSuggestionPosition(pos)
    } else {
      setShowSuggestions(false)
    }
  }, [onChange, getCurrentWord, analyzeContext, allSuggestions, calculateCursorPosition])

  // 应用选中的建议
  const applySuggestion = useCallback((suggestion: SuggestionItem) => {
    isSelectingRef.current = true
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const text = textarea.value

    // 找到单词结束位置
    let end = cursorPos
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) {
      end++
    }

    // 替换文本
    const newText = text.substring(0, wordStartPos) + suggestion.label + text.substring(end)
    onChange(newText)

    // 设置光标位置
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = wordStartPos + suggestion.label.length
      textarea.focus()
      setShowSuggestions(false)
      isSelectingRef.current = false
    }, 0)
  }, [wordStartPos, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 处理补全列表键盘导航
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : prev)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySuggestion(filteredSuggestions[selectedSuggestionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }

    // Ctrl+Enter 执行查询
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      onExecute()
      setShowSuggestions(false)
      return
    }

    // Tab 插入两个空格（如果没有补全列表）
    if (e.key === 'Tab' && !showSuggestions) {
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

  // 获取建议类型图标
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'keyword': return <Key className="w-3 h-3 text-purple-500" />
      case 'function': return <FileCode className="w-3 h-3 text-blue-500" />
      case 'database': return <Database className="w-3 h-3 text-green-500" />
      case 'table': return <Table className="w-3 h-3 text-orange-500" />
      case 'column': return <Columns className="w-3 h-3 text-cyan-500" />
      default: return null
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm relative">
      {/* 标题栏 */}
      <div className="flex-shrink-0 flex items-center px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <FileCode className="w-4 h-4 text-gray-500 dark:text-gray-400 mr-2" />
        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">SQL Query</span>
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{t('database.autocompleteEnabled')}</span>
      </div>

      {/* 编辑器主体 */}
      <div className="flex-1 flex overflow-hidden bg-white dark:bg-gray-900">
        {/* 行号 */}
        <div className="flex-shrink-0 w-10 bg-slate-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-gray-700 select-none overflow-hidden">
          <div className="py-3 px-1 font-mono text-xs text-slate-400 dark:text-slate-500 text-right">
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6 h-6">
                {num}
              </div>
            ))}
          </div>
        </div>

        {/* 编辑器 */}
        <textarea
          ref={textareaRef}
          value={sql}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // 延迟关闭，让点击事件有机会触发
            setTimeout(() => {
              if (!isSelectingRef.current) {
                setShowSuggestions(false)
              }
            }, 150)
          }}
          placeholder={t('database.sqlPlaceholderHint')}
          className="flex-1 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm p-3 resize-none focus:outline-none leading-6 placeholder:text-gray-400 dark:placeholder:text-gray-600"
          spellCheck={false}
          disabled={executing}
        />
      </div>

      {/* 自动补全弹出框 */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg py-1 max-h-[240px] overflow-y-auto min-w-[200px]"
          style={{
            top: suggestionPosition.top,
            left: suggestionPosition.left,
          }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={`suggestion-${index}`}
              ref={el => { suggestionItemRefs.current[index] = el }}
              className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer ${
                index === selectedSuggestionIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onMouseDown={(e) => {
                e.preventDefault() // 阻止 blur 事件
                applySuggestion(suggestion)
              }}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              {getSuggestionIcon(suggestion.type)}
              <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{suggestion.label}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{suggestion.detail}</span>
            </div>
          ))}
        </div>
      )}
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

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

  // 确保数据是二维数组格式
  const normalizedData = data.map(row => {
    if (Array.isArray(row)) {
      return row
    }
    if (typeof row === 'object' && row !== null) {
      return columns.map(col => row[col])
    }
    return [row]
  })

  // 分页
  const totalPages = Math.ceil(normalizedData.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  const pageData = normalizedData.slice(startIndex, endIndex)

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
    setPage(1)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 表格区域 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900">
              {/* 行号列 */}
              <th className="w-14 min-w-[56px] px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                #
              </th>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 border-b-2 border-gray-200 dark:border-gray-700 min-w-[80px] max-w-[300px]"
                >
                  <span className="block truncate" title={col}>{col}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageData.map((row, rowIndex) => {
              const actualIndex = startIndex + rowIndex
              return (
                <tr
                  key={actualIndex}
                  className={`${actualIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}
                >
                  <td className="px-2 py-1.5 text-center text-xs text-gray-400 dark:text-gray-500 font-medium border-r border-gray-100 dark:border-gray-800">
                    {actualIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 font-mono max-w-[300px]"
                    >
                      <CellContent value={cell} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 分页控制 */}
      {normalizedData.length > 50 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {t('common.page')} {page} / {totalPages}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>
              {startIndex + 1}-{Math.min(endIndex, normalizedData.length)} / {normalizedData.length} {t('database.rows')}
            </span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="ml-2 px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
            >
              <option value={50}>50/{t('database.rows')}</option>
              <option value={100}>100/{t('database.rows')}</option>
              <option value={200}>200/{t('database.rows')}</option>
              <option value={500}>500/{t('database.rows')}</option>
            </select>
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
    </div>
  )
}

// 格式化单元格值
// 单元格内容组件 - 截断显示，悬浮显示全部
function CellContent({ value }: { value: any }) {
  if (value === null) {
    return <span className="text-gray-400 dark:text-gray-500 italic text-xs">NULL</span>
  }
  if (value === undefined) {
    return <span className="text-gray-400 dark:text-gray-500 italic text-xs">undefined</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${value ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
        {value ? 'true' : 'false'}
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className="text-blue-600 dark:text-blue-400 font-medium">{value.toLocaleString()}</span>
  }
  if (value instanceof Date) {
    return <span className="text-purple-600 dark:text-purple-400 text-xs">{value.toISOString()}</span>
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value)
    return (
      <span className="text-orange-600 dark:text-orange-400 text-xs block truncate" title={str}>
        {str}
      </span>
    )
  }

  const str = String(value)
  return (
    <span className="block truncate" title={str}>
      {str}
    </span>
  )
}

// 格式化单元格值（简化版，用于其他地方）
function formatCellValue(value: any): React.ReactNode {
  if (value === null) {
    return <span className="text-gray-400 dark:text-gray-500 italic text-xs">NULL</span>
  }
  if (value === undefined) {
    return <span className="text-gray-400 dark:text-gray-500 italic text-xs">undefined</span>
  }
  if (typeof value === 'boolean') {
    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${value ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
        {value ? 'true' : 'false'}
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className="text-blue-600 dark:text-blue-400 font-medium">{value.toLocaleString()}</span>
  }
  if (value instanceof Date) {
    return <span className="text-purple-600 dark:text-purple-400 text-xs">{value.toISOString()}</span>
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value)
    if (str.length > 100) {
      return <span className="text-orange-600 dark:text-orange-400 text-xs">{str.substring(0, 100)}...</span>
    }
    return <span className="text-orange-600 dark:text-orange-400 text-xs">{str}</span>
  }
  const str = String(value)
  if (str.length > 200) {
    return <span>{str.substring(0, 200)}<span className="text-gray-400">...</span></span>
  }
  return str
}

// 执行信息组件
function ExecutionInfo({ result }: { result: QueryResult | null | undefined }) {
  const { t } = useTranslation()
  if (!result) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-850 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
        <Clock className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-gray-600 dark:text-gray-300 font-medium">{result.executionTime}ms</span>
      </div>
      {result.rowCount !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
          <Hash className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-gray-600 dark:text-gray-300 font-medium">{result.rowCount} {t('database.rows')}</span>
        </div>
      )}
      {result.affectedRows !== undefined && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          <span className="text-gray-600 dark:text-gray-300 font-medium">{t('database.rowsAffectedMsg', { count: result.affectedRows })}</span>
        </div>
      )}
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
    tabs,
    activeTabId,
    executing,
    currentResult,
    getActiveTab,
    createQueryTab,
    closeTab,
    setActiveTab,
    updateTabSql,
    executeCurrentTab,
    setActiveDatabase,
    getCachedDatabases,
  } = useDbStore()

  const [editorHeight, setEditorHeight] = useState(350) // 默认编辑器高度
  const [showResult, setShowResult] = useState(false) // 是否显示结果区域
  const [showDbSelector, setShowDbSelector] = useState(false)

  const activeConnection = connections.find((c) => c.id === activeConnectionId)
  const activeTab = getActiveTab()
  const databases = activeConnectionId ? getCachedDatabases(activeConnectionId) || [] : []

  // 处理编辑器高度调整
  const handleEditorResize = useCallback((delta: number) => {
    setEditorHeight(prev => Math.max(150, Math.min(800, prev + delta)))
  }, [])

  // 执行查询后显示结果
  const handleExecute = async () => {
    setShowResult(true)
    return executeCurrentTab()
  }

  // 自动创建标签页
  useEffect(() => {
    if (activeConnectionId && tabs.length === 0) {
      createQueryTab()
    }
  }, [activeConnectionId])

  if (!activeConnectionId || !activeConnection?.connected) {
    return <EmptyState />
  }

  // 根据活动 tab 类型渲染不同内容
  const renderTabContent = () => {
    if (!activeTab) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">{t('database.selectTab')}</p>
        </div>
      )
    }

    switch (activeTab.type) {
      case 'table':
        return (
          <TableDetail
            connectionId={activeTab.connectionId!}
            database={activeTab.database!}
            table={activeTab.itemName!}
          />
        )
      case 'procedure':
        return (
          <ProcedureDetail
            connectionId={activeTab.connectionId!}
            database={activeTab.database!}
            procedure={activeTab.itemName!}
          />
        )
      case 'trigger':
        return (
          <TriggerDetail
            connectionId={activeTab.connectionId!}
            database={activeTab.database!}
            trigger={activeTab.itemName!}
          />
        )
      case 'query':
      default:
        return (
          <QueryEditorContent
            activeTab={activeTab}
            editorHeight={editorHeight}
            showResult={showResult}
            setEditorHeight={setEditorHeight}
            setShowResult={setShowResult}
            handleExecute={handleExecute}
            handleEditorResize={handleEditorResize}
            activeConnectionId={activeConnectionId}
            activeConnection={activeConnection}
            activeDatabase={activeDatabase}
            databases={databases}
            showDbSelector={showDbSelector}
            setShowDbSelector={setShowDbSelector}
            setActiveDatabase={setActiveDatabase}
            updateTabSql={updateTabSql}
            executing={executing}
            t={t}
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* 标签页 */}
      <UnifiedTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTab}
        onClose={closeTab}
        onCreate={() => createQueryTab()}
      />

      {/* 主内容区 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {renderTabContent()}
      </div>
    </div>
  )
}

// 统一标签页组件
function UnifiedTabs({
  tabs,
  activeTabId,
  onSelect,
  onClose,
  onCreate,
}: {
  tabs: UnifiedTab[]
  activeTabId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onCreate: () => void
}) {
  const { t } = useTranslation()

  const getTabIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table className="w-4 h-4 flex-shrink-0 text-orange-500" />
      case 'procedure': return <FileCode className="w-4 h-4 flex-shrink-0 text-green-500" />
      case 'trigger': return <Bolt className="w-4 h-4 flex-shrink-0 text-yellow-500" />
      default: return <FileCode className="w-4 h-4 flex-shrink-0" />
    }
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-2 px-3 py-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer min-w-[100px] max-w-[180px] ${
              activeTabId === tab.id
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
            onClick={() => onSelect(tab.id)}
          >
            {getTabIcon(tab.type)}
            <span className="text-sm truncate flex-1">{tab.name}</span>
            {tab.type === 'query' && tab.isModified && (
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

// SQL 编辑器内容组件
function QueryEditorContent({
  activeTab,
  editorHeight,
  showResult,
  setEditorHeight,
  setShowResult,
  handleExecute,
  handleEditorResize,
  activeConnectionId,
  activeConnection,
  activeDatabase,
  databases,
  showDbSelector,
  setShowDbSelector,
  setActiveDatabase,
  updateTabSql,
  executing,
  t,
}: {
  activeTab: UnifiedTab
  editorHeight: number
  showResult: boolean
  setEditorHeight: (h: number) => void
  setShowResult: (b: boolean) => void
  handleExecute: () => void
  handleEditorResize: (d: number) => void
  activeConnectionId: string
  activeConnection: any
  activeDatabase: string | null
  databases: any[]
  showDbSelector: boolean
  setShowDbSelector: (b: boolean) => void
  setActiveDatabase: (d: string | null) => void
  updateTabSql: (id: string, sql: string) => void
  executing: boolean
  t: (key: string, params?: any) => string
}) {
  return (
    <>
      {/* 工具栏 */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
            <Database className="w-4 h-4" />
            <span className="font-medium">{activeConnection.name}</span>
          </div>

          {databases.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDbSelector(!showDbSelector)}
                className="flex items-center gap-1.5 px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <span className={activeDatabase ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400'}>
                  {activeDatabase || t('database.defaultDatabase')}
                </span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {showDbSelector && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDbSelector(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto min-w-[180px]">
                    {databases.map((db) => (
                      <button
                        key={db.name}
                        onClick={() => {
                          setActiveDatabase(db.name)
                          setShowDbSelector(false)
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                          activeDatabase === db.name
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className="truncate">{db.name}</span>
                        {db.tableCount > 0 && (
                          <span className="text-xs text-gray-400 ml-2">{db.tableCount}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExecute}
            disabled={executing || !activeTab?.sql?.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {t('database.execute')}
          </button>

          <span className="text-xs text-gray-400 dark:text-gray-500">
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Ctrl</kbd>
            +
            <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Enter</kbd>
          </span>
        </div>
      </div>

      {/* SQL 编辑器区域 */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          style={showResult ? { height: editorHeight } : undefined}
          className={`${showResult ? 'min-h-[150px]' : 'flex-1'} overflow-hidden relative`}
        >
          <SqlEditor
            sql={activeTab?.sql || ''}
            onChange={(sql) => activeTab?.id && updateTabSql(activeTab.id, sql)}
            onExecute={handleExecute}
            executing={executing}
            connectionId={activeConnectionId || ''}
            database={activeDatabase}
          />
          {!showResult && activeTab?.result && (
            <button
              onClick={() => setShowResult(true)}
              className="absolute bottom-3 right-3 flex items-center gap-1 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg shadow-sm text-xs text-gray-600 dark:text-gray-300 transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              {t('database.viewResult')}
            </button>
          )}
        </div>

        {showResult && (
          <>
            <ResizableDivider onResize={handleEditorResize} />
            <div className="flex-1 min-h-[100px] flex flex-col">
              <div className="flex-shrink-0 flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <span className="text-xs text-gray-500 dark:text-gray-400">{t('database.queryResult')}</span>
                <button
                  onClick={() => setShowResult(false)}
                  className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                  title={t('database.hideResult')}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <DataGrid result={activeTab?.result} loading={executing} />
              <ExecutionInfo result={activeTab?.result} />
            </div>
          </>
        )}
      </div>
    </>
  )
}