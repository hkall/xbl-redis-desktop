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
  Key,
  Bolt,
  Download,
  Check,
  Pencil,
  Trash2,
  Filter,
  XCircle,
  Search,
  FileText,
  Clipboard,
  Upload,
} from 'lucide-react'
import { useDbStore } from '@/store/dbStore'
import { QueryResult, UnifiedTab } from '@/types/database'
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
      const delta = e.clientY - startY.current
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

// SQL格式化函数
function formatSql(sql: string): string {
  if (!sql.trim()) return sql

  // 保留注释行
  const lines = sql.split('\n')
  const comments: Map<number, string> = new Map()
  const stripped = lines.map((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
      comments.set(i, trimmed)
      return ''
    }
    return line
  }).join('\n')

  // 保护字符串字面量
  const strings: string[] = []
  let prepared = stripped.replace(/'[^']*'/g, (m) => { strings.push(m); return `__STR_${strings.length - 1}__` })
  prepared = prepared.replace(/"[^"]*"/g, (m) => { strings.push(m); return `__STR_${strings.length - 1}__` })

  // 关键字列表
  const keywords = new Set([
    'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
    'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'JOIN', 'CROSS', 'ON',
    'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'IS', 'NULL', 'AS',
    'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
    'UNION', 'ALL', 'INTERSECT', 'EXCEPT',
    'ASC', 'DESC', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE',
  ])

  // 换行关键字（前面插入换行）
  const breakKeywords = [
    'SELECT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
    'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN', 'CROSS JOIN',
    'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
  ]

  // 逗号后换行（用于列列表）
  // 标准化空白
  let result = prepared.replace(/\s+/g, ' ').trim()

  // 关键字转大写
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace(/\s/g, '\\s+')}\\b`, 'gi')
    result = result.replace(regex, kw)
  })

  // 换行关键字前插入换行
  breakKeywords.forEach(kw => {
    const escaped = kw.replace(/\s/g, '\\s+')
    const regex = new RegExp(`\\s+(${escaped})\\b`, 'gi')
    result = result.replace(regex, '\n$1')
  })

  // 分号后换行
  result = result.replace(/;\s*/g, ';\n')

  // 合并 SELECT * / SELECT col 到同一行
  result = result.replace(/\bSELECT\s*\n\s*([*\w]+)/gi, 'SELECT $1')

  // 逗号后换行（SELECT列、INSERT列等），但避免破坏已合并的行
  result = result.replace(/,\s*/g, ',\n')

  // 处理缩进
  const indentIncreasers = ['SELECT', 'INSERT INTO', 'UPDATE', 'DELETE FROM', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN', 'CROSS JOIN']
  const indentDecreasers = ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'JOIN', 'CROSS JOIN']

  const resultLines = result.split('\n').filter(l => l.trim())
  let indent = 0
  const formatted = resultLines.map(line => {
    const upper = line.trim().toUpperCase()

    // 先减缩进（当前行以这些关键字开头）
    if (indentDecreasers.some(kw => upper.startsWith(kw))) {
      indent = Math.max(0, indent - 1)
    }

    const indented = '  '.repeat(indent) + line.trim()

    // 再加缩进（当前行以这些关键字开头，影响后续行）
    if (indentIncreasers.some(kw => upper.startsWith(kw))) {
      indent++
    }

    return indented
  })

  // 恢复注释
  let finalResult = formatted.join('\n')
  // 恢复字符串
  strings.forEach((s, i) => {
    finalResult = finalResult.replace(`__STR_${i}__`, s)
  })

  return finalResult
}

// 自动补全项
interface SuggestionItem {
  label: string
  type: 'keyword' | 'function' | 'database' | 'table' | 'column'
  detail?: string
}

// SQL 编辑器组件
function SqlEditor({
  sql,
  onChange,
  onExecute,
  onFormat,
  executing,
  connectionId,
  database,
}: {
  sql: string
  onChange: (sql: string) => void
  onExecute: (sqlOverride?: string) => void
  onFormat: () => void
  executing: boolean
  connectionId: string
  database: string | null
}) {
  const { t } = useTranslation()
  const { getCachedTables, getCachedColumns, getCachedDatabases } = useDbStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [lineNumbers, setLineNumbers] = useState<number[]>([1])
  const [filteredSuggestions, setFilteredSuggestions] = useState<SuggestionItem[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 })
  const [wordStartPos, setWordStartPos] = useState(0)
  const suggestionItemRefs = useRef<(HTMLDivElement | null)[]>([])
  const isSelectingRef = useRef(false)

  const allSuggestions = useCallback(() => {
    const itemsMap = new Map<string, SuggestionItem>()

    SQL_KEYWORDS.forEach(kw => {
      if (!itemsMap.has(kw)) {
        itemsMap.set(kw, { label: kw, type: 'keyword', detail: t('database.keyword') })
      }
    })

    SQL_FUNCTIONS.forEach(fn => {
      if (!itemsMap.has(fn)) {
        itemsMap.set(fn, { label: fn, type: 'function', detail: t('database.function') })
      }
    })

    const databases = getCachedDatabases(connectionId) || []
    databases.forEach(db => {
      if (!itemsMap.has(db.name)) {
        itemsMap.set(db.name, { label: db.name, type: 'database', detail: `${db.tableCount || 0} ${t('database.tables')}` })
      }
    })

    if (database) {
      const tables = getCachedTables(connectionId, database) || []
      tables.forEach(tbl => {
        if (!itemsMap.has(tbl.name)) {
          itemsMap.set(tbl.name, { label: tbl.name, type: 'table', detail: tbl.type || t('database.table') })
        }
        const columns = getCachedColumns(connectionId, database, tbl.name) || []
        columns.forEach(col => {
          if (!itemsMap.has(col.name)) {
            itemsMap.set(col.name, {
              label: col.name,
              type: 'column',
              detail: `${col.type || ''}${col.isPrimaryKey ? ' (PK)' : ''}`
            })
          }
        })
      })
    }

    return Array.from(itemsMap.values())
  }, [connectionId, database, getCachedDatabases, getCachedTables, getCachedColumns, t])

  useEffect(() => {
    const lines = sql.split('\n').length
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1))
  }, [sql])

  useEffect(() => {
    if (showSuggestions && suggestionItemRefs.current[selectedSuggestionIndex]) {
      suggestionItemRefs.current[selectedSuggestionIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedSuggestionIndex, showSuggestions])

  const calculateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return { top: 0, left: 0 }

    const cursorPos = textarea.selectionStart
    const lines = textarea.value.substring(0, cursorPos).split('\n')
    const currentColumn = lines[lines.length - 1].length

    return {
      top: textarea.getBoundingClientRect().top + lines.length * 24 - textarea.scrollTop + 24,
      left: textarea.getBoundingClientRect().left + 10 + currentColumn * 8
    }
  }, [])

  const getCurrentWord = useCallback((text: string, cursorPos: number) => {
    let start = cursorPos
    while (start > 0 && /[a-zA-Z0-9_]/.test(text[start - 1])) start--
    let end = cursorPos
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) end++
    return { word: text.substring(start, end), start, end }
  }, [])

  const analyzeContext = useCallback((text: string, cursorPos: number) => {
    const textBeforeCursor = text.substring(0, cursorPos).toUpperCase()
    if (/(FROM|JOIN)\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) return 'table'
    if (/SELECT\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor) || /SELECT\s+[^,]+\s*,\s*[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) return 'column-or-function'
    if (/USE\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) return 'database'
    if (/WHERE\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor) || /(AND|OR)\s+[a-zA-Z0-9_]*$/i.test(textBeforeCursor)) return 'column'
    return 'any'
  }, [])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSql = e.target.value
    onChange(newSql)

    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const { word, start } = getCurrentWord(newSql, cursorPos)
    setWordStartPos(start)

    if (word.length >= 1) {
      const contextType = analyzeContext(newSql, cursorPos)
      const allItems = allSuggestions()

      let contextFiltered = allItems
      if (contextType === 'table') contextFiltered = allItems.filter(s => s.type === 'table' || s.type === 'database')
      else if (contextType === 'column') contextFiltered = allItems.filter(s => s.type === 'column' || s.type === 'function')
      else if (contextType === 'column-or-function') contextFiltered = allItems.filter(s => s.type === 'column' || s.type === 'function' || s.type === 'keyword')
      else if (contextType === 'database') contextFiltered = allItems.filter(s => s.type === 'database')

      const wordLower = word.toLowerCase()
      const filtered = contextFiltered.filter(s => s.label.toLowerCase().startsWith(wordLower)).slice(0, 15)

      setFilteredSuggestions(filtered)
      setSelectedSuggestionIndex(0)
      setShowSuggestions(filtered.length > 0)
      setSuggestionPosition(calculateCursorPosition())
    } else {
      setShowSuggestions(false)
    }
  }, [onChange, getCurrentWord, analyzeContext, allSuggestions, calculateCursorPosition])

  const applySuggestion = useCallback((suggestion: SuggestionItem) => {
    isSelectingRef.current = true
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const text = textarea.value
    let end = cursorPos
    while (end < text.length && /[a-zA-Z0-9_]/.test(text[end])) end++

    const newText = text.substring(0, wordStartPos) + suggestion.label + text.substring(end)
    onChange(newText)

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = wordStartPos + suggestion.label.length
      textarea.focus()
      setShowSuggestions(false)
      isSelectingRef.current = false
    }, 0)
  }, [wordStartPos, onChange])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev < filteredSuggestions.length - 1 ? prev + 1 : prev)
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

    // Execute: selected text, or current statement, or full SQL
    const executeSelectedOrAll = () => {
      const textarea = textareaRef.current
      if (!textarea) { onExecute(); return }
      const selStart = textarea.selectionStart
      const selEnd = textarea.selectionEnd
      if (selStart !== selEnd) {
        // Execute selected text
        onExecute(sql.substring(selStart, selEnd))
      } else {
        // Execute current statement (find ; boundaries)
        const text = sql
        let stmtStart = selStart
        let stmtEnd = selStart
        while (stmtStart > 0 && text[stmtStart - 1] !== ';') stmtStart--
        while (stmtEnd < text.length && text[stmtEnd] !== ';') stmtEnd++
        if (stmtEnd < text.length) stmtEnd++ // include the ;
        const stmt = text.substring(stmtStart, stmtEnd).trim()
        onExecute(stmt || sql)
      }
      setShowSuggestions(false)
    }

    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      executeSelectedOrAll()
      return
    }

    if (e.key === 'F5') {
      e.preventDefault()
      executeSelectedOrAll()
      return
    }

    if (e.key === 'F' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
      e.preventDefault()
      onFormat()
      setShowSuggestions(false)
      return
    }

    if (e.key === 'Tab' && !showSuggestions) {
      e.preventDefault()
      const textarea = textareaRef.current
      if (textarea) {
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const newSql = sql.substring(0, start) + '  ' + sql.substring(end)
        onChange(newSql)
        setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + 2 }, 0)
      }
    }
  }

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'keyword': return <Key className="w-3.5 h-3.5 text-purple-500" />
      case 'function': return <FileCode className="w-3.5 h-3.5 text-blue-500" />
      case 'database': return <Database className="w-3.5 h-3.5 text-green-500" />
      case 'table': return <Table className="w-3.5 h-3.5 text-orange-500" />
      case 'column': return <Columns className="w-3.5 h-3.5 text-cyan-500" />
      default: return null
    }
  }

  const highlightSql = (text: string) => {
    const parts: { text: string; type: 'keyword' | 'function' | 'string' | 'number' | 'normal' }[] = []
    const tokens = text.split(/(\s+|'[^']*'|"[^"]*"|\d+(?:\.\d+)?|[(),;*\-+\/=<>!&|]+)/)

    tokens.forEach(token => {
      if (!token) return
      if (/^\s+$/.test(token)) { parts.push({ text: token, type: 'normal' }); return }
      if (/^['"][^'"]*['"]$/.test(token)) { parts.push({ text: token, type: 'string' }); return }
      if (/^\d+(?:\.\d+)?$/.test(token)) { parts.push({ text: token, type: 'number' }); return }

      const upperToken = token.toUpperCase()
      if (SQL_KEYWORDS.includes(upperToken)) { parts.push({ text: token, type: 'keyword' }); return }

      const funcName = token.replace(/\(.*\)$/, '').toUpperCase() + '()'
      if (SQL_FUNCTIONS.includes(funcName) || SQL_FUNCTIONS.some(f => f.toUpperCase() === upperToken)) {
        parts.push({ text: token, type: 'function' }); return
      }

      parts.push({ text: token, type: 'normal' })
    })

    return parts
  }

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-md border border-gray-300 dark:border-gray-600 shadow-sm relative">
      <div className="flex-shrink-0 flex items-center px-2 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <FileCode className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 mr-2" />
        <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">SQL Query</span>
        <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">{t('database.autocompleteEnabled')}</span>
      </div>

      <div className="flex-1 flex overflow-hidden bg-white dark:bg-gray-900">
        <div className="flex-shrink-0 w-10 bg-slate-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-gray-700 select-none overflow-hidden">
          <div className="py-2 px-1 font-mono text-[11px] text-slate-400 dark:text-slate-500 text-right">
            {lineNumbers.map((num) => (
              <div key={num} className="leading-6 h-6">{num}</div>
            ))}
          </div>
        </div>

        <div className="flex-1 relative">
          <div className="absolute inset-0 font-mono text-[13px] p-2 leading-6 overflow-auto whitespace-pre-wrap break-words pointer-events-none" aria-hidden="true">
            {highlightSql(sql).map((part, index) => {
              let colorClass = 'text-gray-800 dark:text-gray-200'
              if (part.type === 'keyword') colorClass = 'text-purple-600 dark:text-purple-400 font-semibold'
              else if (part.type === 'function') colorClass = 'text-blue-600 dark:text-blue-400'
              else if (part.type === 'string') colorClass = 'text-green-600 dark:text-green-400'
              else if (part.type === 'number') colorClass = 'text-orange-600 dark:text-orange-400'
              return <span key={index} className={colorClass}>{part.text}</span>
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={sql}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={() => { setTimeout(() => { if (!isSelectingRef.current) setShowSuggestions(false) }, 150) }}
            placeholder={t('database.sqlPlaceholderHint')}
            className="absolute inset-0 bg-transparent text-transparent caret-gray-800 dark:caret-gray-200 font-mono text-[13px] p-2 resize-none focus:outline-none leading-6 placeholder:text-gray-400 dark:placeholder:text-gray-600"
            spellCheck={false}
            disabled={executing}
          />
        </div>
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 max-h-[240px] overflow-y-auto min-w-[200px]"
          style={{ top: suggestionPosition.top, left: suggestionPosition.left }}
        >
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={`suggestion-${index}`}
              ref={el => { suggestionItemRefs.current[index] = el }}
              className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer ${index === selectedSuggestionIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              onMouseDown={(e) => { e.preventDefault(); applySuggestion(suggestion) }}
              onMouseEnter={() => setSelectedSuggestionIndex(index)}
            >
              {getSuggestionIcon(suggestion.type)}
              <span className="font-mono text-[13px] text-gray-700 dark:text-gray-300">{suggestion.label}</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto">{suggestion.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 检测id列（扩展检测规则）
function detectIdColumn(columns: string[]): number | null {
  const idNames = ['id', 'ID', 'Id', '_id', 'uid', 'UID', 'pk', 'PK', 'primary_key', 'key', 'KEY', 'uuid', 'UUID', 'sid', 'SID']
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i].toLowerCase()
    // 精确匹配
    if (idNames.includes(col)) return i
    // 包含id的后缀匹配（如 user_id, order_id）
    if (col.endsWith('_id') || col.endsWith('id') && col.length > 2) return i
  }
  return null
}

// 从SQL提取表名
function extractTableNameFromSql(sql: string): string | null {
  // 匹配 SELECT ... FROM table
  const fromMatch = sql.match(/FROM\s+`?(\w+)`?\s*(?:WHERE|ORDER|GROUP|LIMIT|;|$)/i)
  if (fromMatch) return fromMatch[1]
  // 匹配 UPDATE table SET
  const updateMatch = sql.match(/UPDATE\s+`?(\w+)`?\s+SET/i)
  if (updateMatch) return updateMatch[1]
  // 匹配 INSERT INTO table
  const insertMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i)
  if (insertMatch) return insertMatch[1]
  // 匹配 DELETE FROM table
  const deleteMatch = sql.match(/DELETE\s+FROM\s+`?(\w+)`?/i)
  if (deleteMatch) return deleteMatch[1]
  return null
}

// 篮选条件类型
interface FilterCondition {
  column: number
  operator: 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'isNull' | 'isNotNull'
  value: string
}

// 多列排序类型
interface SortCondition {
  column: number
  direction: 'asc' | 'desc'
}

// 数据表格组件 - DBeaver风格
function DataGrid({
  result,
  loading,
  connectionId,
  database,
  tableName,
  onRefresh,
  sourceSql,  // 原始SQL，用于提取表名
}: {
  result: QueryResult | null | undefined
  loading: boolean
  connectionId: string
  database: string | null
  tableName?: string
  onRefresh?: () => void
  sourceSql?: string
}) {
  const { t } = useTranslation()
  const columns = result?.columns || []

  // 自动推断表名和主键（DBeaver风格）
  const inferredTableName = tableName || (sourceSql ? extractTableNameFromSql(sourceSql) : null)
  const inferredIdCol = detectIdColumn(columns)

  // 编辑状态 - 简化流程，自动启用编辑
  const [editTableName, setEditTableName] = useState(inferredTableName || '')
  const [selectedIdColumn, setSelectedIdColumn] = useState<number | null>(inferredIdCol)
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [pendingChanges, setPendingChanges] = useState<Array<{ rowIndex: number; colIndex: number; newValue: any }>>([])

  // 其他状态
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [sortColumns, setSortColumns] = useState<SortCondition[]>([])
  const [columnWidths, setColumnWidths] = useState<number[]>([])
  const [resizingColumn, setResizingColumn] = useState<number | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // 篮选状态
  const [filters, setFilters] = useState<FilterCondition[]>([])
  const [filterColumn, setFilterColumn] = useState<number | null>(null)
  const [filterOperator, setFilterOperator] = useState<FilterCondition['operator']>('contains')
  const [filterValue, setFilterValue] = useState('')
  const [showFilterPanel, setShowFilterPanel] = useState<number | null>(null)

  // 单元格焦点和键盘导航
  const [focusedCell, setFocusedCell] = useState<{ rowIndex: number; colIndex: number } | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(new Set())
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [findText, setFindText] = useState('')
  const [findMatches, setFindMatches] = useState<Array<{ rowIndex: number; colIndex: number }>>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)
  const [showFindBar, setShowFindBar] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const contextMenuCellRef = useRef<{ rowIndex: number; colIndex: number } | null>(null)

  // 列头右键菜单状态
  const [columnContextMenu, setColumnContextMenu] = useState<{ x: number; y: number; colIndex: number } | null>(null)

  // 当结果变化时自动推断表名和主键
  useEffect(() => {
    // 表名：优先传入的tableName，其次从SQL推断
    const newTableName = tableName || (sourceSql ? extractTableNameFromSql(sourceSql) : null)
    setEditTableName(newTableName || '')
    // 主键：自动检测
    const newIdCol = detectIdColumn(columns)
    setSelectedIdColumn(newIdCol)
  }, [tableName, sourceSql, columns])

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const x = Math.min(e.clientX, window.innerWidth - 170)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setContextMenu({ x, y })
  }

  // 执行导出
  const handleExport = (format: 'csv' | 'json' | 'sql') => {
    setContextMenu(null)
    const data = getSortedData()
    const tbl = tableName || 'export_table'
    if (format === 'csv') exportToCsv(columns, data, 'query_result')
    else if (format === 'json') exportToJson(columns, data, 'query_result')
    else if (format === 'sql') exportToSqlInsert(columns, data, tbl, 'query_result')
  }

  // 保存确认对话框
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [saveConfirmMessage, setSaveConfirmMessage] = useState('')

  // 保存所有更改 — 弹出SQL确认对话框
  const showSaveConfirmation = () => {
    if (!database || pendingChanges.length === 0) return
    const effectiveTable = tableName || editTableName
    if (!effectiveTable) return

    // 使用手动选择或自动检测的主键列
    const effectiveIdCol = selectedIdColumn !== null ? selectedIdColumn : detectIdColumn(columns)
    if (effectiveIdCol === null) return

    const sqls = pendingChanges.map(change => {
      const idValue = sortedData[change.rowIndex][effectiveIdCol]
      const colName = columns[change.colIndex]
      return `UPDATE \`${effectiveTable}\` SET \`${colName}\` = ${change.newValue === null ? 'NULL' : `'${String(change.newValue).replace(/'/g, "''")}'`} WHERE \`${columns[effectiveIdCol]}\` = ${typeof idValue === 'number' || !isNaN(Number(idValue)) ? idValue : `'${idValue}'`};`
    })
    setSaveConfirmMessage(sqls.join('\n'))
    setShowSaveConfirm(true)
  }

  const executeSaveChanges = async () => {
    setShowSaveConfirm(false)
    if (!database || pendingChanges.length === 0) return
    const effectiveTable = tableName || editTableName
    if (!effectiveTable) return

    // 使用手动选择或自动检测的主键列
    const effectiveIdCol = selectedIdColumn !== null ? selectedIdColumn : detectIdColumn(columns)
    if (effectiveIdCol === null) return

    try {
      for (const change of pendingChanges) {
        const idValue = sortedData[change.rowIndex][effectiveIdCol]
        const colName = columns[change.colIndex]
        const sql = `UPDATE \`${effectiveTable}\` SET \`${colName}\` = ${change.newValue === null ? 'NULL' : `'${String(change.newValue).replace(/'/g, "''")}'`} WHERE \`${columns[effectiveIdCol]}\` = ${typeof idValue === 'number' || !isNaN(Number(idValue)) ? idValue : `'${idValue}'`}`

        const res = await window.electronAPI?.dbExecuteQuery?.(connectionId, sql, database)
        if (!res?.success) {
          alert(`${t('common.error')}: ${res?.error}`)
          return
        }
      }
      setPendingChanges([])
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    }
  }

  // Ctrl+S 弹出确认
  const saveAllChangesRef = useRef(showSaveConfirmation)
  saveAllChangesRef.current = showSaveConfirmation

  useEffect(() => {
    if (pendingChanges.length === 0) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        e.stopImmediatePropagation()
        saveAllChangesRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [pendingChanges])

  // 删除选中行
  const deleteSelectedRows = async () => {
    setContextMenu(null)
    if (!database || selectedRows.size === 0) return

    // 使用手动选择或自动检测的主键列
    const effectiveIdCol = selectedIdColumn !== null ? selectedIdColumn : detectIdColumn(columns)
    if (effectiveIdCol === null) {
      alert(t('database.noPrimaryKeyWarning'))
      return
    }

    const effectiveTable = tableName || editTableName
    if (!effectiveTable) return

    if (!confirm(t('database.confirmDeleteRowsMsg', { count: selectedRows.size }))) return

    try {
      for (const rowIndex of selectedRows) {
        const idValue = sortedData[rowIndex][effectiveIdCol]
        const sql = `DELETE FROM \`${effectiveTable}\` WHERE \`${columns[effectiveIdCol]}\` = ${typeof idValue === 'number' || !isNaN(Number(idValue)) ? idValue : `'${idValue}'`}`

        const res = await window.electronAPI?.dbExecuteQuery?.(connectionId, sql, database)
        if (!res?.success) {
          alert(`${t('common.error')}: ${res?.error}`)
          return
        }
      }
      setSelectedRows(new Set())
      onRefresh?.()
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    }
  }

  // 编辑相关
  const startEdit = (rowIndex: number, colIndex: number) => {
    const effectiveTable = tableName || editTableName
    if (!effectiveTable) return
    const value = sortedData[rowIndex]?.[colIndex]
    setEditValue(value === null ? '' : String(value))
    setEditingCell({ rowIndex, colIndex })
  }

  const confirmEdit = () => {
    if (!editingCell) return
    const newValue = editValue === '' ? null : editValue
    // 更新本地数据
    sortedData[editingCell.rowIndex][editingCell.colIndex] = newValue
    // 添加到待保存列表
    setPendingChanges(prev => [...prev, { ...editingCell, newValue }])
    setEditingCell(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmEdit() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
    else if (e.key === 'Tab') {
      e.preventDefault()
      confirmEdit()
      const visibleCols = columns.map((_, i) => i).filter(i => !hiddenColumns.has(i))
      if (editingCell && visibleCols.length > 0) {
        const currentIdx = visibleCols.indexOf(editingCell.colIndex)
        const nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1
        if (nextIdx >= 0 && nextIdx < visibleCols.length) {
          startEdit(editingCell.rowIndex, visibleCols[nextIdx])
        }
      }
    }
  }

  // 键盘导航
  const handleGridKeyDown = (e: React.KeyboardEvent) => {
    if (editingCell) return // let edit handler deal with it

    const visibleCols = columns.map((_, i) => i).filter(i => !hiddenColumns.has(i))
    if (visibleCols.length === 0) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
        e.key === 'Tab' || e.key === 'Enter' || e.key === 'F2' || e.key === 'Escape' || e.key === 'Delete') {
      e.preventDefault()
    } else {
      // Ctrl+F for find
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setShowFindBar(true)
        return
      }
      // F3 / Shift+F3 for find navigation
      if (e.key === 'F3') {
        e.preventDefault()
        if (findMatches.length > 0) {
          const dir = e.shiftKey ? -1 : 1
          const next = (currentMatchIndex + dir + findMatches.length) % findMatches.length
          setCurrentMatchIndex(next)
          setFocusedCell(findMatches[next])
        }
        return
      }
      return
    }

    if (!focusedCell) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') {
        setFocusedCell({ rowIndex: 0, colIndex: visibleCols[0] })
      }
      return
    }

    const { rowIndex, colIndex } = focusedCell
    const colIdx = visibleCols.indexOf(colIndex)

    switch (e.key) {
      case 'Escape':
        setFocusedCell(null)
        return
      case 'F2':
      case 'Enter':
        if (canEdit && columns[colIndex]) startEdit(rowIndex, colIndex)
        return
      case 'Delete':
        // DBeaver-style: start editing as if setting NULL, show save/cancel
        if (canEdit && columns[colIndex]) {
          const currentVal = sortedData[rowIndex]?.[colIndex]
          setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal))
          setEditingCell({ rowIndex, colIndex })
        }
        return
      case 'ArrowDown':
        if (rowIndex < sortedData.length - 1) setFocusedCell({ rowIndex: rowIndex + 1, colIndex })
        return
      case 'ArrowUp':
        if (rowIndex > 0) setFocusedCell({ rowIndex: rowIndex - 1, colIndex })
        return
      case 'ArrowRight':
        if (colIdx < visibleCols.length - 1) setFocusedCell({ rowIndex, colIndex: visibleCols[colIdx + 1] })
        return
      case 'ArrowLeft':
        if (colIdx > 0) setFocusedCell({ rowIndex, colIndex: visibleCols[colIdx - 1] })
        return
      case 'Tab':
        if (e.shiftKey) {
          // Shift+Tab: previous cell
          if (colIdx > 0) {
            setFocusedCell({ rowIndex, colIndex: visibleCols[colIdx - 1] })
          } else if (rowIndex > 0) {
            setFocusedCell({ rowIndex: rowIndex - 1, colIndex: visibleCols[visibleCols.length - 1] })
          }
        } else {
          // Tab: next cell
          if (colIdx < visibleCols.length - 1) {
            setFocusedCell({ rowIndex, colIndex: visibleCols[colIdx + 1] })
          } else if (rowIndex < sortedData.length - 1) {
            setFocusedCell({ rowIndex: rowIndex + 1, colIndex: visibleCols[0] })
          }
        }
        return
    }
  }

  // Find in results
  const performFind = (text: string) => {
    setFindText(text)
    if (!text.trim()) { setFindMatches([]); setCurrentMatchIndex(-1); return }
    const matches: Array<{ rowIndex: number; colIndex: number }> = []
    const lower = text.toLowerCase()
    const visibleCols = columns.map((_, i) => i).filter(i => !hiddenColumns.has(i))
    for (let r = 0; r < sortedData.length; r++) {
      for (const c of visibleCols) {
        const val = sortedData[r]?.[c]
        if (val !== null && val !== undefined && String(val).toLowerCase().includes(lower)) {
          matches.push({ rowIndex: r, colIndex: c })
        }
      }
    }
    setFindMatches(matches)
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1)
    if (matches.length > 0) setFocusedCell(matches[0])
  }

  // 列宽调整
  const handleResizeMouseDown = (colIndex: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(colIndex)
    startXRef.current = e.clientX
    startWidthRef.current = columnWidths[colIndex] || 150
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    if (resizingColumn === null) return
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      const newWidth = Math.max(80, Math.min(500, startWidthRef.current + delta))
      setColumnWidths(prev => { const w = [...prev]; w[resizingColumn] = newWidth; return w })
    }
    const handleMouseUp = () => { setResizingColumn(null); document.body.style.cursor = ''; document.body.style.userSelect = '' }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp) }
  }, [resizingColumn])

  // 排序 - 支持多列排序（Shift+点击添加）
  const handleColumnClick = (colIndex: number, e: React.MouseEvent) => {
    if (resizingColumn !== null) return

    // Shift+点击添加排序列
    if (e.shiftKey) {
      const existingIndex = sortColumns.findIndex(s => s.column === colIndex)
      if (existingIndex >= 0) {
        // 已存在则切换方向
        const newSorts = [...sortColumns]
        newSorts[existingIndex] = {
          column: colIndex,
          direction: newSorts[existingIndex].direction === 'asc' ? 'desc' : 'asc'
        }
        setSortColumns(newSorts)
      } else {
        // 不存在则添加
        setSortColumns([...sortColumns, { column: colIndex, direction: 'asc' }])
      }
    } else {
      // 普通点击：单列排序
      const existingIndex = sortColumns.findIndex(s => s.column === colIndex)
      if (existingIndex >= 0 && sortColumns.length === 1) {
        // 单列时切换方向
        setSortColumns([{ column: colIndex, direction: sortColumns[0].direction === 'asc' ? 'desc' : 'asc' }])
      } else {
        // 设置为单列排序
        setSortColumns([{ column: colIndex, direction: 'asc' }])
      }
    }
    setPage(1)
  }

  // 列头右键菜单处理
  const handleColumnContextMenu = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 250)
    setColumnContextMenu({ x, y, colIndex })
  }

  const closeColumnContextMenu = () => setColumnContextMenu(null)

  // 列头右键菜单操作
  const sortColumnAsc = () => {
    if (!columnContextMenu) return
    setSortColumns([{ column: columnContextMenu.colIndex, direction: 'asc' }])
    setPage(1)
    closeColumnContextMenu()
  }

  const sortColumnDesc = () => {
    if (!columnContextMenu) return
    setSortColumns([{ column: columnContextMenu.colIndex, direction: 'desc' }])
    setPage(1)
    closeColumnContextMenu()
  }

  const clearSort = () => {
    setSortColumns([])
    setPage(1)
    closeColumnContextMenu()
  }

  const hideColumn = () => {
    if (!columnContextMenu) return
    setHiddenColumns(prev => new Set(prev).add(columnContextMenu.colIndex))
    closeColumnContextMenu()
  }

  const autoFitThisColumn = () => {
    if (!columnContextMenu) return
    autoFitColumnWidth(columnContextMenu.colIndex)
    closeColumnContextMenu()
  }

  // 获取排序后的数据
  const getSortedData = () => {
    if (!result?.data) return []
    const data = result.data.map(row => Array.isArray(row) ? row : typeof row === 'object' && row !== null ? result.columns!.map(col => row[col]) : [row])

    // 先筛选
    let filteredData = data
    if (filters.length > 0) {
      filteredData = data.filter(row => {
        return filters.every(filter => {
          const cellValue = row[filter.column]
          const strValue = cellValue === null || cellValue === undefined ? '' : String(cellValue)

          switch (filter.operator) {
            case 'contains':
              return strValue.toLowerCase().includes(filter.value.toLowerCase())
            case 'notContains':
              return !strValue.toLowerCase().includes(filter.value.toLowerCase())
            case 'equals':
              return strValue === filter.value
            case 'notEquals':
              return strValue !== filter.value
            case 'startsWith':
              return strValue.toLowerCase().startsWith(filter.value.toLowerCase())
            case 'endsWith':
              return strValue.toLowerCase().endsWith(filter.value.toLowerCase())
            case 'greaterThan':
              const numVal = parseFloat(strValue)
              const filterNum = parseFloat(filter.value)
              if (!isNaN(numVal) && !isNaN(filterNum)) return numVal > filterNum
              return strValue > filter.value
            case 'lessThan':
              const numVal2 = parseFloat(strValue)
              const filterNum2 = parseFloat(filter.value)
              if (!isNaN(numVal2) && !isNaN(filterNum2)) return numVal2 < filterNum2
              return strValue < filter.value
            case 'isNull':
              return cellValue === null || cellValue === undefined
            case 'isNotNull':
              return cellValue !== null && cellValue !== undefined
            default:
              return true
          }
        })
      })
    }

    // 再排序
    if (sortColumns.length === 0) return filteredData
    return [...filteredData].sort((a, b) => {
      for (const sort of sortColumns) {
        const valA = a[sort.column], valB = b[sort.column]
        if (valA === null || valA === undefined) return sort.direction === 'asc' ? -1 : 1
        if (valB === null || valB === undefined) return sort.direction === 'asc' ? 1 : -1
        if (typeof valA === 'number' && typeof valB === 'number') {
          const cmp = sort.direction === 'asc' ? valA - valB : valB - valA
          if (cmp !== 0) return cmp
        } else {
          const cmp = sort.direction === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA))
          if (cmp !== 0) return cmp
        }
      }
      return 0
    })
  }

  // 添加筛选条件
  const addFilter = () => {
    if (filterColumn === null) return
    const newFilter: FilterCondition = {
      column: filterColumn,
      operator: filterOperator,
      value: filterValue
    }
    setFilters([...filters, newFilter])
    setFilterColumn(null)
    setFilterOperator('contains')
    setFilterValue('')
    setShowFilterPanel(null)
    setPage(1)
  }

  // 清除单个筛选
  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
    setPage(1)
  }

  // 清除所有筛选
  const clearAllFilters = () => {
    setFilters([])
    setPage(1)
  }

  // 自动调整列宽
  const autoFitColumnWidth = (colIndex: number) => {
    if (!result?.data) return
    const column = result.columns?.[colIndex]
    if (!column) return

    // 计算该列最大内容宽度
    let maxWidth = column.length * 8 + 40 // 列名宽度
    const sampleData = result.data.slice(0, 100) // 取前100行估算
    sampleData.forEach(row => {
      const cell = Array.isArray(row) ? row[colIndex] : row[column]
      const cellWidth = (cell === null ? 4 : String(cell).length) * 8 + 20
      if (cellWidth > maxWidth) maxWidth = cellWidth
    })
    maxWidth = Math.min(maxWidth, 500) // 最大500

    setColumnWidths(prev => {
      const w = [...prev]
      w[colIndex] = maxWidth
      return w
    })
  }

  // 重置所有列宽
  const resetAllColumnWidths = () => {
    if (result?.columns?.length) {
      setColumnWidths(result.columns.map(() => 150))
    }
  }

  // 行选择
  const handleRowSelect = (rowIndex: number, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => { const s = new Set(prev); s.has(rowIndex) ? s.delete(rowIndex) : s.add(rowIndex); return s })
    } else if (e.shiftKey && selectedRows.size > 0) {
      const last = [...selectedRows].pop() || rowIndex
      const start = Math.min(last, rowIndex), end = Math.max(last, rowIndex)
      setSelectedRows(new Set([...Array(end - start + 1)].map((_, i) => start + i)))
    } else {
      setSelectedRows(new Set([rowIndex]))
    }
  }

  // 初始化列宽
  useEffect(() => {
    if (result?.columns?.length) {
      setColumnWidths(result.columns.map(() => 150))
      setSelectedRows(new Set())
      setPendingChanges([])
    }
  }, [result?.columns])

  // 复制 (行选中复制行，单元格焦点复制单元格)
  useEffect(() => {
    const handleCopy = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedRows.size > 0) {
          e.preventDefault()
          const data = getSortedData()
          const text = [...selectedRows].sort((a, b) => a - b).map(i => data[i]?.map(c => c === null || c === undefined ? '' : String(c)).join('\t') || '').join('\n')
          navigator.clipboard.writeText(text)
        } else if (focusedCell && !editingCell) {
          e.preventDefault()
          const val = sortedData[focusedCell.rowIndex]?.[focusedCell.colIndex]
          navigator.clipboard.writeText(val === null || val === undefined ? '' : String(val))
        }
      }
    }
    document.addEventListener('keydown', handleCopy)
    return () => document.removeEventListener('keydown', handleCopy)
  }, [selectedRows, focusedCell, editingCell, result, sortColumns, filters])

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
  if (!result) return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400 dark:text-gray-500 text-[13px]">{t('database.executeQueryResult')}</p></div>
  if (!result.success) return <div className="flex-1 flex flex-col items-center justify-center p-3"><AlertCircle className="w-8 h-8 text-red-500 mb-2" /><p className="text-red-500 text-[13px] text-center">{result.error}</p></div>
  if (!result.data || result.data.length === 0) return <div className="flex-1 flex flex-col items-center justify-center"><CheckCircle className="w-8 h-8 text-green-500 mb-2" /><p className="text-gray-500 dark:text-gray-400 text-[13px]">{result.affectedRows !== undefined ? t('database.rowsAffectedMsg', { count: result.affectedRows }) : result.rowCount === 0 ? t('database.querySuccessNoData') : t('database.querySuccessful')}</p></div>

  const sortedData = getSortedData()
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const startIndex = (page - 1) * pageSize
  const pageData = sortedData.slice(startIndex, startIndex + pageSize)
  // 使用自动检测或手动选择的主键列
  const effectiveIdCol = selectedIdColumn !== null ? selectedIdColumn : detectIdColumn(columns)
  const effectiveTable = tableName || editTableName
  const canEdit = database && effectiveIdCol !== null && effectiveTable
  const hasChanges = pendingChanges.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0" onContextMenu={handleContextMenu}>
      {/* 篮选状态栏 */}
      {filters.length > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <Filter className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span className="text-[11px] text-blue-600 dark:text-blue-400">{t('database.filter')}:</span>
          {filters.map((filter, idx) => (
            <span key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-800 rounded text-[11px]">
              <span className="text-gray-600 dark:text-gray-300">{columns[filter.column]}</span>
              <span className="text-gray-400 dark:text-gray-500">{t(`database.${filter.operator}`)}</span>
              {filter.value && <span className="text-blue-500 dark:text-blue-400 font-medium">"{filter.value}"</span>}
              <button onClick={() => removeFilter(idx)} className="ml-1 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                <XCircle className="w-3 h-3 text-gray-400 hover:text-red-500" />
              </button>
            </span>
          ))}
          <button onClick={clearAllFilters} className="ml-2 px-2 py-0.5 text-[11px] text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            {t('database.clearFilter')}
          </button>
        </div>
      )}

      {/* 表格 */}
      <div className="flex-1 overflow-auto" ref={gridRef} tabIndex={0} onKeyDown={handleGridKeyDown} style={{ outline: 'none' }}>
        <table className="w-full border-collapse table-auto">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-b from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900">
              <th className="w-14 px-2 py-1.5 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">#</th>
              {columns.map((col, i) => {
                if (hiddenColumns.has(i)) return null
                const sortIndex = sortColumns.findIndex(s => s.column === i)
                const hasFilter = filters.some(f => f.column === i)
                return (
                  <th key={i} onClick={e => handleColumnClick(i, e)} onContextMenu={e => handleColumnContextMenu(e, i)} style={{ width: columnWidths[i] || 150 }} className="relative px-2 py-1.5 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 border-b-2 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 group">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-gray-700 dark:text-gray-200">{col}</span>
                      {/* 排序指示器 */}
                      {sortIndex >= 0 ? (
                        <div className="flex items-center gap-0.5">
                          {sortColumns[sortIndex].direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500 dark:text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-500 dark:text-blue-400" />}
                          {sortColumns.length > 1 && <span className="text-[11px] text-blue-500 dark:text-blue-400 font-medium">{sortIndex + 1}</span>}
                        </div>
                      ) : (
                        <ArrowUp className="w-3 h-3 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-30" />
                      )}
                      {/* 篮选图标 */}
                      <button
                        onClick={e => { e.stopPropagation(); setShowFilterPanel(showFilterPanel === i ? null : i) }}
                        className={`ml-1 p-0.5 rounded ${hasFilter ? 'bg-blue-100 dark:bg-blue-900/30' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                      >
                        <Filter className={`w-3 h-3 ${hasFilter ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
                      </button>
                    </div>
                    {/* 列宽调整边界 */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 bg-transparent hover:bg-blue-500 dark:hover:bg-blue-400 cursor-col-resize"
                      onMouseDown={e => handleResizeMouseDown(i, e)}
                      onDoubleClick={e => { e.stopPropagation(); autoFitColumnWidth(i) }}
                    />
                    {/* 篮选面板 */}
                    {showFilterPanel === i && (
                      <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-2 z-20 min-w-[200px]" onClick={e => e.stopPropagation()}>
                        <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('database.filterBy', { column: col })}</div>
                        <select
                          value={filterOperator}
                          onChange={e => setFilterOperator(e.target.value as FilterCondition['operator'])}
                          className="w-full px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded mb-1.5 text-gray-700 dark:text-gray-300"
                        >
                          <option value="contains">{t('database.contains')}</option>
                          <option value="notContains">{t('database.notContains')}</option>
                          <option value="equals">{t('database.equals')}</option>
                          <option value="notEquals">{t('database.notEquals')}</option>
                          <option value="startsWith">{t('database.startsWith')}</option>
                          <option value="endsWith">{t('database.endsWith')}</option>
                          <option value="greaterThan">{t('database.greaterThan')}</option>
                          <option value="lessThan">{t('database.lessThan')}</option>
                          <option value="isNull">{t('database.isNull')}</option>
                          <option value="isNotNull">{t('database.isNotNull')}</option>
                        </select>
                        {filterOperator !== 'isNull' && filterOperator !== 'isNotNull' && (
                          <input
                            type="text"
                            value={filterValue}
                            onChange={e => setFilterValue(e.target.value)}
                            placeholder={t('common.value')}
                            className="w-full px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded mb-1.5 text-gray-700 dark:text-gray-300"
                          />
                        )}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setFilterColumn(i); addFilter() }}
                            className="flex-1 px-2 py-1 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded"
                          >
                            {t('common.add')}
                          </button>
                          <button
                            onClick={() => { setShowFilterPanel(null); setFilterValue('') }}
                            className="px-2 py-1 text-[11px] bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {pageData.map((row, rowIndex) => {
              const actualIndex = startIndex + rowIndex
              const isSelected = selectedRows.has(actualIndex)
              return (
                <tr key={actualIndex} onClick={e => handleRowSelect(actualIndex, e)} className={`${isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : actualIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/30'} hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors`}>
                  <td className="px-2 py-1 text-center text-[11px] text-gray-400 dark:text-gray-500 font-medium border-r border-gray-100 dark:border-gray-800">{isSelected ? <Check className="w-3 h-3 text-blue-500 dark:text-blue-400" /> : actualIndex + 1}</td>
                  {row.map((cell, colIndex) => {
                    if (hiddenColumns.has(colIndex)) return null
                    const isEditing = editingCell?.rowIndex === actualIndex && editingCell?.colIndex === colIndex
                    const isChanged = pendingChanges.some(c => c.rowIndex === actualIndex && c.colIndex === colIndex)
                    const isFocused = focusedCell?.rowIndex === actualIndex && focusedCell?.colIndex === colIndex
                    const isFindMatch = findMatches.some(m => m.rowIndex === actualIndex && m.colIndex === colIndex)
                    const isCurrentMatch = currentMatchIndex >= 0 && findMatches[currentMatchIndex]?.rowIndex === actualIndex && findMatches[currentMatchIndex]?.colIndex === colIndex
                    return (
                      <td
                        key={colIndex}
                        style={{ width: columnWidths[colIndex] || 150 }}
                        onDoubleClick={() => canEdit && startEdit(actualIndex, colIndex)}
                        onClick={() => setFocusedCell({ rowIndex: actualIndex, colIndex })}
                        onContextMenu={() => { contextMenuCellRef.current = { rowIndex: actualIndex, colIndex } }}
                        className={`px-2 py-1 text-[13px] font-mono relative ${isChanged ? 'bg-orange-50 dark:bg-orange-900/20' : ''} ${isCurrentMatch ? 'ring-2 ring-orange-500 dark:ring-orange-400' : isFindMatch ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''} ${isFocused && !isEditing ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}`}
                      >
                        {isEditing ? (
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            onBlur={() => setTimeout(cancelEdit, 150)}
                            autoFocus
                            className="absolute inset-0 px-2 py-1 text-[13px] font-mono text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-b-2 border-blue-500 focus:outline-none z-10"
                          />
                        ) : (
                          <CellContent value={cell} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 查找栏 */}
      {showFindBar && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <span className="text-[11px] text-yellow-600 dark:text-yellow-400">{t('common.search')}:</span>
          <input value={findText} onChange={e => performFind(e.target.value)} className="w-40 px-2 py-1 text-[11px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white" autoFocus onKeyDown={e => { if (e.key === 'Escape') { setShowFindBar(false); setFindText(''); setFindMatches([]); setCurrentMatchIndex(-1) } if (e.key === 'Enter' && findMatches.length > 0) { const dir = e.shiftKey ? -1 : 1; const next = (currentMatchIndex + dir + findMatches.length) % findMatches.length; setCurrentMatchIndex(next); setFocusedCell(findMatches[next]) } }} />
          {findText && <span className="text-[11px] text-gray-500 dark:text-gray-400">{findMatches.length > 0 ? `${currentMatchIndex + 1}/${findMatches.length}` : '0/0'}</span>}
          <button onClick={() => { if (findMatches.length > 0) { const next = (currentMatchIndex - 1 + findMatches.length) % findMatches.length; setCurrentMatchIndex(next); setFocusedCell(findMatches[next]) } }} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Shift+F3"><ChevronUp className="w-3.5 h-3.5" /></button>
          <button onClick={() => { if (findMatches.length > 0) { const next = (currentMatchIndex + 1) % findMatches.length; setCurrentMatchIndex(next); setFocusedCell(findMatches[next]) } }} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="F3"><ChevronDown className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setShowFindBar(false); setFindText(''); setFindMatches([]); setCurrentMatchIndex(-1) }} className="ml-auto p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* 状态栏 - 始终显示 */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span>{sortedData.length} {t('database.rows')}</span>
          {totalPages > 1 && <><span className="text-gray-300 dark:text-gray-600">|</span><span>{t('common.page')} {page}/{totalPages}</span></>}
          {selectedRows.size > 0 && <><span className="text-gray-300 dark:text-gray-600">|</span><span className="text-blue-500 dark:text-blue-400">{t('database.selectedRowsCount', { count: selectedRows.size })}</span></>}
          {hiddenColumns.size > 0 && <><span className="text-gray-300 dark:text-gray-600">|</span><span className="text-gray-400 dark:text-gray-500">{hiddenColumns.size} {t('database.columnsHidden')}</span></>}
          {findMatches.length > 0 && <><span className="text-gray-300 dark:text-gray-600">|</span><span className="text-yellow-600 dark:text-yellow-400">{currentMatchIndex + 1}/{findMatches.length}</span></>}
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="ml-1 px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-[11px] text-gray-700 dark:text-gray-300">
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          {totalPages > 1 && (
            <>
              <button onClick={() => setPage(1)} disabled={page === 1} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronFirst className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLast className="w-3.5 h-3.5" /></button>
              <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
            </>
          )}
          {/* Find */}
          <button onClick={() => setShowFindBar(!showFindBar)} className={`p-1 rounded ${showFindBar ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title="Ctrl+F"><Search className="w-3.5 h-3.5" /></button>
          {/* Column visibility */}
          <div className="relative">
            <button onClick={() => setShowColumnMenu(!showColumnMenu)} className={`p-1 rounded ${showColumnMenu ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title={t('database.columnsTab')}><Columns className="w-3.5 h-3.5" /></button>
            {showColumnMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-1.5 z-20 max-h-60 overflow-y-auto min-w-[180px]">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{t('database.columnsTab')}</span>
                    <button onClick={() => setHiddenColumns(new Set())} className="text-[11px] text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300">{t('database.showAllColumns')}</button>
                  </div>
                  {columns.map((col, i) => (
                    <label key={i} className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input type="checkbox" checked={!hiddenColumns.has(i)} onChange={() => setHiddenColumns(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })} className="rounded border-gray-300 dark:border-gray-600 text-blue-500" />
                      <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate">{col}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {/* Save/Cancel buttons - only shown when there are pending changes */}
          {hasChanges && (
            <>
              <button
                onClick={showSaveConfirmation}
                className="flex items-center gap-1 px-2 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium transition-colors"
                title="Ctrl+S"
              >
                <Save className="w-3.5 h-3.5" />
                {pendingChanges.length}
              </button>
              <button
                onClick={() => { setPendingChanges([]); onRefresh?.() }}
                className="p-1 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                title={t('common.cancel')}
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {/* Export dropdown */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className={`p-1 rounded ${showExportMenu ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`} title={t('database.exportData')}>
              <Upload className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 bottom-full mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 z-20 min-w-[120px]">
                  <button onClick={() => { handleExport('csv'); setShowExportMenu(false) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><FileText className="w-3.5 h-3.5" />{t('database.exportCsv')}</button>
                  <button onClick={() => { handleExport('json'); setShowExportMenu(false) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><FileText className="w-3.5 h-3.5" />{t('database.exportJson')}</button>
                  <button onClick={() => { handleExport('sql'); setShowExportMenu(false) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><FileCode className="w-3.5 h-3.5" />{t('database.exportSql')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
            {contextMenuCellRef.current && (
              <>
                <button onClick={() => { const c = contextMenuCellRef.current!; const val = sortedData[c.rowIndex]?.[c.colIndex]; navigator.clipboard.writeText(val === null || val === undefined ? '' : String(val)); setContextMenu(null) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Clipboard className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.copyCellValue')}</button>
                <button onClick={() => { const c = contextMenuCellRef.current!; const val = sortedData[c.rowIndex]?.[c.colIndex]; if (val !== null && val !== undefined) { setFilters([...filters, { column: c.colIndex, operator: 'equals', value: String(val) }]); setPage(1) } setContextMenu(null) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Filter className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />{t('database.filterByValue')}</button>
                {canEdit && (
                  <button onClick={() => { const c = contextMenuCellRef.current!; const currentVal = sortedData[c.rowIndex]?.[c.colIndex]; setEditValue(currentVal === null || currentVal === undefined ? '' : String(currentVal)); setEditingCell({ rowIndex: c.rowIndex, colIndex: c.colIndex }); setContextMenu(null) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Pencil className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('common.edit')}</button>
                )}
                {canEdit && (
                  <button onClick={() => { const c = contextMenuCellRef.current!; setEditValue(''); setEditingCell({ rowIndex: c.rowIndex, colIndex: c.colIndex }); setContextMenu(null) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><XCircle className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.setNull')}</button>
                )}
                <button onClick={() => { const c = contextMenuCellRef.current!; const row = sortedData[c.rowIndex]; const effectiveTable = tableName || editTableName; if (effectiveTable) { const vals = row.map(v => v === null || v === undefined ? 'NULL' : typeof v === 'number' || !isNaN(Number(v)) ? String(v) : `'${String(v).replace(/'/g, "''")}'`); const sql = `INSERT INTO \`${effectiveTable}\` (${columns.map(col => `\`${col}\``).join(', ')}) VALUES (${vals.join(', ')});`; navigator.clipboard.writeText(sql) } setContextMenu(null) }} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.copyAsInsert')}</button>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
              </>
            )}
            <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.exportCsv')}</button>
            <button onClick={() => handleExport('json')} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.exportJson')}</button>
            <button onClick={() => handleExport('sql')} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><Download className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />{t('database.exportSql')}</button>
            {canEdit && selectedRows.size > 0 && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                <button onClick={deleteSelectedRows} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" />{t('database.deleteSelectedRows')}</button>
              </>
            )}
          </div>
        </>
      )}

      {/* 列头右键菜单 */}
      {columnContextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeColumnContextMenu} />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 min-w-[140px]"
            style={{ left: columnContextMenu.x, top: columnContextMenu.y }}
          >
            <button onClick={sortColumnAsc} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              <ArrowUp className="w-3.5 h-3.5" />
              {t('database.sortAsc')}
            </button>
            <button onClick={sortColumnDesc} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              <ArrowDown className="w-3.5 h-3.5" />
              {t('database.sortDesc')}
            </button>
            {sortColumns.length > 0 && (
              <button onClick={clearSort} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-3.5 h-3.5" />
                {t('database.sortNone')}
              </button>
            )}
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <button onClick={hideColumn} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Eye className="w-3.5 h-3.5" />
              {t('database.hideColumn')}
            </button>
            <button onClick={autoFitThisColumn} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Columns className="w-3.5 h-3.5" />
              {t('database.autoFitWidth')}
            </button>
            <button onClick={resetAllColumnWidths} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
              <RefreshCw className="w-3.5 h-3.5" />
              {t('database.resetAllWidths')}
            </button>
          </div>
        </>
      )}

      {/* SQL保存确认对话框 - DBeaver风格 */}
      {showSaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSaveConfirm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-xl border border-gray-200 dark:border-gray-600 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{t('database.confirmSaveChanges')}</h3>
              <button onClick={() => setShowSaveConfirm(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">{t('database.confirmSaveChangesHint')}</p>
              <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-2 text-[11px] font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">{saveConfirmMessage}</pre>
            </div>
            <div className="flex justify-end gap-1.5 px-2 py-1.5 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowSaveConfirm(false)} className="px-3 py-1.5 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">{t('common.cancel')}</button>
              <button onClick={executeSaveChanges} className="px-3 py-1.5 text-[13px] bg-green-500 hover:bg-green-600 text-white rounded transition-colors">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// 导出函数
function exportToCsv(columns: string[], data: any[][], filename: string) {
  const rows = ['﻿' + columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',')]
  data.forEach(row => rows.push(row.map(c => c === null || c === undefined ? '' : `"${String(c).replace(/"/g, '""')}"`).join(',')))
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

function exportToJson(columns: string[], data: any[][], filename: string) {
  const json = data.map(row => { const obj: Record<string, any> = {}; columns.forEach((c, i) => obj[c] = row[i]); return obj })
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

function exportToSqlInsert(columns: string[], data: any[][], tableName: string, filename: string) {
  const sqls = data.map(row => {
    const vals = row.map(v => {
      if (v === null || v === undefined) return 'NULL'
      if (typeof v === 'number') return String(v)
      return `'${String(v).replace(/'/g, "''")}'`
    })
    return `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${vals.join(', ')});`
  })
  const blob = new Blob([sqls.join('\n')], { type: 'text/plain;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.sql`
  link.click()
  URL.revokeObjectURL(link.href)
}

// CellContent组件
function CellContent({ value }: { value: any }) {
  if (value === null) return <span className="text-gray-400 dark:text-gray-500 italic text-[11px]">NULL</span>
  if (value === undefined) return <span className="text-gray-400 dark:text-gray-500 italic text-[11px]">undefined</span>
  if (typeof value === 'boolean') return <span className={`px-1 py-0.5 rounded text-[11px] font-medium ${value ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{value ? 'true' : 'false'}</span>
  if (typeof value === 'number') return <span className="text-blue-600 dark:text-blue-400 font-medium">{value.toLocaleString()}</span>
  if (value instanceof Date) return <span className="text-purple-600 dark:text-purple-400 text-[11px]">{value.toISOString()}</span>
  if (typeof value === 'object') return <span className="text-orange-600 dark:text-orange-400 text-[11px] truncate block" title={JSON.stringify(value)}>{JSON.stringify(value)}</span>
  return <span className="text-gray-700 dark:text-gray-300 truncate block" title={String(value)}>{String(value)}</span>
}

// ExecutionInfo组件
function ExecutionInfo({ result }: { result: QueryResult | null | undefined }) {
  const { t } = useTranslation()
  if (!result) return null
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-[11px]">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"><Clock className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /><span className="text-gray-600 dark:text-gray-300 font-medium">{result.executionTime}ms</span></div>
      {result.rowCount !== undefined && <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"><Hash className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" /><span className="text-gray-600 dark:text-gray-300 font-medium">{result.rowCount} {t('database.rows')}</span></div>}
      {result.affectedRows !== undefined && <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600"><CheckCircle className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /><span className="text-gray-600 dark:text-gray-300 font-medium">{t('database.rowsAffectedMsg', { count: result.affectedRows })}</span></div>}
    </div>
  )
}

// EmptyState
function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-900">
      <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-gray-500 dark:text-gray-400 text-[13px] mb-2">{t('database.selectConnectionQuery')}</p>
      <p className="text-gray-400 dark:text-gray-500 text-[11px]">{t('database.orCreateConnection')}</p>
    </div>
  )
}

// 主组件
export default function DbWorkspace() {
  const { t } = useTranslation()
  const { connections, activeConnectionId, activeDatabase, tabs, activeTabId, executing, getActiveTab, createQueryTab, closeTab, setActiveTab, updateTabSql, executeCurrentTab, setActiveDatabase, getCachedDatabases } = useDbStore()
  const [editorHeight, setEditorHeight] = useState(350)
  const [showResult, setShowResult] = useState(false)
  const [showDbSelector, setShowDbSelector] = useState(false)

  const activeConnection = connections.find(c => c.id === activeConnectionId)
  const activeTab = getActiveTab()
  const databases = activeConnectionId ? getCachedDatabases(activeConnectionId) || [] : []

  const handleEditorResize = useCallback((delta: number) => setEditorHeight(prev => Math.max(150, Math.min(800, prev + delta))), [])
  const handleExecute = useCallback(async (sqlOverride?: string) => { setShowResult(true); return executeCurrentTab(sqlOverride) }, [executeCurrentTab])

  useEffect(() => { if (activeConnectionId && tabs.length === 0) createQueryTab() }, [activeConnectionId])

  if (!activeConnectionId || !activeConnection?.connected) return <EmptyState />

  const renderTabContent = () => {
    if (!activeTab) return <div className="flex-1 flex items-center justify-center"><p className="text-gray-400 text-[13px]">{t('database.selectTab')}</p></div>
    switch (activeTab.type) {
      case 'table': return <TableDetail connectionId={activeTab.connectionId!} database={activeTab.database!} table={activeTab.itemName!} />
      case 'procedure': return <ProcedureDetail connectionId={activeTab.connectionId!} database={activeTab.database!} procedure={activeTab.itemName!} />
      case 'trigger': return <TriggerDetail connectionId={activeTab.connectionId!} database={activeTab.database!} trigger={activeTab.itemName!} />
      default: return <QueryEditorContent activeTab={activeTab} editorHeight={editorHeight} showResult={showResult} setShowResult={setShowResult} handleExecute={handleExecute} handleEditorResize={handleEditorResize} activeConnectionId={activeConnectionId} activeConnection={activeConnection} activeDatabase={activeDatabase} databases={databases} showDbSelector={showDbSelector} setShowDbSelector={setShowDbSelector} setActiveDatabase={setActiveDatabase} updateTabSql={updateTabSql} executing={executing} t={t} />
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      <UnifiedTabs tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTab} onClose={closeTab} onCreate={() => createQueryTab()} />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{renderTabContent()}</div>
    </div>
  )
}

// UnifiedTabs
function UnifiedTabs({ tabs, activeTabId, onSelect, onClose, onCreate }: { tabs: UnifiedTab[]; activeTabId: string | null; onSelect: (id: string) => void; onClose: (id: string) => void; onCreate: () => void }) {
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string; tabIndex: number } | null>(null)

  const getIcon = (type: string) => type === 'table' ? <Table className="w-3.5 h-3.5 text-orange-500 dark:text-orange-400" /> : type === 'procedure' ? <FileCode className="w-3.5 h-3.5 text-green-500 dark:text-green-400" /> : type === 'trigger' ? <Bolt className="w-3.5 h-3.5 text-yellow-500 dark:text-yellow-400" /> : <FileCode className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />

  const handleContextMenu = (e: React.MouseEvent, tabId: string, tabIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 160)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setContextMenu({ x, y, tabId, tabIndex })
  }

  const closeContextMenu = () => setContextMenu(null)

  // 关闭其他标签页
  const closeOtherTabs = () => {
    if (!contextMenu) return
    tabs.filter(t => t.id !== contextMenu.tabId).forEach(t => onClose(t.id))
    closeContextMenu()
  }

  // 关闭右侧标签页
  const closeRightTabs = () => {
    if (!contextMenu) return
    tabs.slice(contextMenu.tabIndex + 1).forEach(t => onClose(t.id))
    closeContextMenu()
  }

  // 关闭所有标签页
  const closeAllTabs = () => {
    tabs.forEach(t => onClose(t.id))
    closeContextMenu()
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-2 py-1.5 border-r border-gray-200 dark:border-gray-700 cursor-pointer min-w-[100px] max-w-[180px] ${activeTabId === tab.id ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            onClick={() => onSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id, index)}
          >
            {getIcon(tab.type)}
            <span className="text-[13px] truncate">{tab.name}</span>
            {tab.type === 'query' && tab.isModified && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400" />}
            <button onClick={e => { e.stopPropagation(); onClose(tab.id) }} className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3 text-gray-400 dark:text-gray-500" /></button>
          </div>
        ))}
      </div>
      <button onClick={onCreate} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" title={t('database.newQueryTitle')}><Plus className="w-3.5 h-3.5" /></button>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1 min-w-[140px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { onClose(contextMenu.tabId); closeContextMenu() }}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-3.5 h-3.5" />
              {t('database.closeTab')}
            </button>
            <button
              onClick={closeOtherTabs}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('database.closeOtherTabs')}
            </button>
            <button
              onClick={closeRightTabs}
              disabled={contextMenu.tabIndex >= tabs.length - 1}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('database.closeRightTabs')}
            </button>
            <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
            <button
              onClick={closeAllTabs}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[13px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t('database.closeAllTabs')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// QueryEditorContent
function QueryEditorContent({ activeTab, editorHeight, showResult, setShowResult, handleExecute, handleEditorResize, activeConnectionId, activeConnection, activeDatabase, databases, showDbSelector, setShowDbSelector, setActiveDatabase, updateTabSql, executing, t }: {
  activeTab: UnifiedTab | null
  editorHeight: number
  showResult: boolean
  setShowResult: (v: boolean) => void
  handleExecute: (sqlOverride?: string) => Promise<any>
  handleEditorResize: (delta: number) => void
  activeConnectionId: string
  activeConnection: any
  activeDatabase: string | null
  databases: any[]
  showDbSelector: boolean
  setShowDbSelector: (v: boolean) => void
  setActiveDatabase: (db: string) => void
  updateTabSql: (id: string, sql: string) => void
  executing: boolean
  t: (key: string, params?: any) => string
}) {
  const { getQueryHistory, addSavedQuery, setActiveResult, clearTabResults } = useDbStore()
  const [showHistory, setShowHistory] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [queryName, setQueryName] = useState('')
  const history = getQueryHistory(100).filter(h => h.connectionId === activeConnectionId).slice(0, 20)

  const handleSaveQuery = () => { if (queryName.trim() && activeTab?.sql?.trim()) { addSavedQuery(queryName.trim(), activeTab.sql); setShowSaveDialog(false); setQueryName('') } }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (activeTab?.sql?.trim()) { setShowSaveDialog(true); setQueryName(activeTab.name || '') } } }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTab?.sql, activeTab?.name])

  // 获取当前显示的结果
  const getCurrentResult = (): QueryResult | undefined => {
    if (!activeTab) return undefined
    if (activeTab.results && activeTab.results.length > 0) {
      const activeResult = activeTab.results.find(r => r.id === activeTab.activeResultId)
      return activeResult?.result
    }
    return activeTab.result
  }

  const currentResult = getCurrentResult()

  // 多SQL结果数量
  const resultCount = activeTab?.results?.length || (activeTab?.result ? 1 : 0)

  return (
    <>
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-lg p-3 w-80 border border-gray-200 dark:border-gray-600" onClick={e => e.stopPropagation()}>
            <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white mb-2">{t('database.saveQuery')}</h3>
            <input value={queryName} onChange={e => setQueryName(e.target.value)} placeholder={t('database.queryName')} className="w-full px-2 py-1.5 text-[13px] bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 mb-2" autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveQuery(); if (e.key === 'Escape') setShowSaveDialog(false) }} />
            <div className="flex justify-end gap-1.5">
              <button onClick={() => setShowSaveDialog(false)} className="px-2 py-1 text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSaveQuery} disabled={!queryName.trim()} className="px-2 py-1 text-[13px] bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-[13px] text-gray-700 dark:text-gray-300"><Database className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" /><span className="font-medium">{activeConnection.name}</span></div>
          {databases.length > 0 && (
            <div className="relative">
              <button onClick={() => setShowDbSelector(!showDbSelector)} className="flex items-center gap-1.5 px-2 py-1 text-[13px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md text-gray-700 dark:text-gray-300 transition-colors"><span>{activeDatabase || t('database.defaultDatabase')}</span><ChevronDown className="w-3 h-3" /></button>
              {showDbSelector && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDbSelector(false)} />
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto min-w-[180px]">
                    {databases.map(db => (
                      <button key={db.name} onClick={() => { setActiveDatabase(db.name); setShowDbSelector(false) }} className={`w-full flex items-center justify-between px-2 py-1.5 text-[13px] ${activeDatabase === db.name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                        <span>{db.name}</span>
                        {db.tableCount > 0 && <span className="text-[11px] text-gray-400 dark:text-gray-500">{db.tableCount}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button onClick={() => { setShowSaveDialog(true); setQueryName(activeTab?.name || '') }} disabled={!activeTab?.sql?.trim()} className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[13px] rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Save className="w-3.5 h-3.5" /></button>
          <button onClick={() => activeTab?.id && updateTabSql(activeTab.id, formatSql(activeTab.sql || ''))} disabled={!activeTab?.sql?.trim()} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-[13px] rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><FileCode className="w-3.5 h-3.5" />{t('database.format')}</button>
          <button onClick={() => handleExecute()} disabled={executing || !activeTab?.sql?.trim()} className="flex items-center gap-1 px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-[13px] rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}{t('database.execute')}</button>
          <span className="text-[11px] text-gray-400 dark:text-gray-500"><kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Ctrl</kbd>+<kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Enter</kbd></span>

          <div className="relative">
            <button onClick={() => setShowHistory(!showHistory)} className="flex items-center px-1.5 py-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"><Clock className="w-3.5 h-3.5" /></button>
            {showHistory && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowHistory(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-20 max-h-80 overflow-y-auto min-w-[400px]">
                  {history.length === 0 ? <div className="px-2 py-1.5 text-[13px] text-gray-400 dark:text-gray-500 text-center">{t('database.noQueryHistory')}</div> : history.map(item => (
                    <button key={item.id} onClick={() => { if (activeTab?.id) { updateTabSql(activeTab.id, item.sql); setShowHistory(false) } }} className="w-full flex flex-col gap-1 px-2 py-1.5 text-[13px] hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors">
                      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-[11px]"><Clock className="w-3 h-3" /><span>{new Date(item.timestamp).toLocaleString()}</span><span className="text-gray-300 dark:text-gray-600">|</span><span>{item.executionTime}ms</span>{item.rowCount !== undefined && <><span className="text-gray-300 dark:text-gray-600">|</span><span>{item.rowCount} rows</span></>}</div>
                      <div className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate">{item.sql}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <div style={showResult ? { height: editorHeight } : undefined} className={`${showResult ? 'min-h-[150px]' : 'flex-1'} overflow-hidden relative`}>
          <SqlEditor sql={activeTab?.sql || ''} onChange={sql => activeTab?.id && updateTabSql(activeTab.id, sql)} onExecute={handleExecute} onFormat={() => activeTab?.id && updateTabSql(activeTab.id, formatSql(activeTab.sql || ''))} executing={executing} connectionId={activeConnectionId || ''} database={activeDatabase} />
          {!showResult && resultCount > 0 && (
            <button onClick={() => setShowResult(true)} className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-sm text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><ChevronUp className="w-3.5 h-3.5" />{t('database.viewResult')} {resultCount > 1 && <span className="text-blue-500">({resultCount})</span>}</button>
          )}
        </div>

        {showResult && (
          <>
            <ResizableDivider onResize={handleEditorResize} />
            <div className="flex-1 min-h-[100px] flex flex-col">
              <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('database.queryResult')}</span>
                  {/* 多SQL结果标签页 */}
                  {activeTab?.results && activeTab.results.length > 1 && (
                    <div className="flex items-center gap-1 ml-1.5">
                      {activeTab.results.map((resultItem, index) => (
                        <button
                          key={resultItem.id}
                          onClick={() => setActiveResult(activeTab!.id, resultItem.id)}
                          className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                            activeTab.activeResultId === resultItem.id
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          <span className="font-medium">#{index + 1}</span>
                          {resultItem.status === 'success' && <CheckCircle className="w-3 h-3 text-green-500" />}
                          {resultItem.status === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
                          {resultItem.status === 'executing' && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                        </button>
                      ))}
                      <button
                        onClick={() => activeTab?.id && clearTabResults(activeTab.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title={t('common.clear')}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowResult(false)} className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
              </div>
              <DataGrid
                result={currentResult}
                loading={executing}
                connectionId={activeConnectionId}
                database={activeDatabase}
                tableName={activeTab?.itemName}
                onRefresh={handleExecute}
                sourceSql={activeTab?.sql}
              />
              <ExecutionInfo result={currentResult} />
            </div>
          </>
        )}
      </div>
    </>
  )
}