import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Download, FileJson, FileText, Database, RefreshCw, CheckCircle2, X, FileSpreadsheet, CheckSquare, Square, Archive, DownloadCloud } from 'lucide-react'
import { customStringify } from '@/utils/formatter'
import { useRedisStore } from '@/store/redisStore'

interface DataExportProps {
  connectionId: string | null
}

interface KeyInfo {
  name: string
  type: string
  checked: boolean
}

// RedisGetResult 接口定义
interface RedisGetResult {
  success: boolean
  data: any
  encoding?: string
  error?: string
}

type ExportMode = 'single' | 'archive'
type ExportFormat = 'json' | 'csv' | 'txt'

export default function DataExport({ connectionId }: DataExportProps) {
  const { connections } = useRedisStore()
  const [keys, setKeys] = useState<KeyInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [searchPattern, setSearchPattern] = useState('*')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [exportMode, setExportMode] = useState<ExportMode>('single')
  const [selectAll, setSelectAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportResults, setExportResults] = useState<{ exported: number; skipped: number; error?: string } | null>(null)

  // Get connection status
  const activeConnection = connectionId
    ? connections.find((c) => c.id === connectionId)
    : null
  const isConnected = activeConnection?.connected || false

  // Lazy loading state - similar to HashViewer
  const [visibleKeys, setVisibleKeys] = useState<KeyInfo[]>([])
  const [visibleCount, setVisibleCount] = useState(50)
  const [allKeysLoaded, setAllKeysLoaded] = useState(false)

  // Table container ref for scroll listening
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  // Load all keys initiallly
  const loadKeys = useCallback(async () => {
    if (!connectionId || !window.electronAPI?.redisScan) return

    setLoading(true)
    setKeys([])
    setVisibleKeys([])
    setVisibleCount(50)
    setAllKeysLoaded(false)
    loadingMoreRef.current = false

    try {
      // Load all keys at once (similar to how HashViewer loads all fields)
      let allScannedKeys: string[] = []
      let cursor = '0'

      do {
        const result = await window.electronAPI.redisScan(connectionId, searchPattern, 1000, cursor)
        if (result.success && result.data) {
          allScannedKeys.push(...result.data)
          cursor = result.cursor
        }
      } while (cursor !== '0')

      // Get type for each key
      const keysWithTypes = await Promise.all(
        allScannedKeys.map(async (key) => {
          const infoResult = await window.electronAPI.redisKeyInfo(connectionId, key)
          return {
            name: key,
            type: infoResult.success && infoResult.data ? infoResult.data.type : 'unknown',
            checked: false,
          }
        })
      )

      setKeys(keysWithTypes)

      // Load first batch immediately (similar to HashViewer)
      const firstBatch = keysWithTypes.slice(0, 50)
      setVisibleKeys(firstBatch)
      setAllKeysLoaded(keysWithTypes.length <= 50)

    } catch (error) {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [connectionId, searchPattern])

  useEffect(() => {
    if (connectionId && isConnected) {
      loadKeys()
    } else {
      setKeys([])
    }
  }, [connectionId, isConnected, loadKeys])

  // Reset visible state when keys or pattern changes
  useEffect(() => {
    setVisibleKeys([])
    setVisibleCount(50)
    setAllKeysLoaded(false)
    loadingMoreRef.current = false
  }, [keys])

  // Calculate currently visible data - similar to HashViewer
  useEffect(() => {
    if (keys.length === 0) {
      setVisibleKeys([])
      setAllKeysLoaded(true)
      return
    }

    const currentVisible = keys.slice(0, visibleCount)
    setVisibleKeys(currentVisible)
    setAllKeysLoaded(visibleCount >= keys.length)

    // Reset loading state after loading completes
    if (loadingMoreRef.current && visibleCount >= keys.length) {
      loadingMoreRef.current = false
    }
  }, [keys, visibleCount])

  // Scroll to bottom auto load more - similar to HashViewer
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (allKeysLoaded || loadingMoreRef.current) return

      const { scrollTop, scrollHeight, clientHeight } = container
      // When scrolling close to bottom, load more
      if (scrollHeight - scrollTop - clientHeight < 50) {
        loadingMoreRef.current = true
        setVisibleCount(prev => {
          const newVal = prev + 50
          // Short delay before resetting loading state
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
  }, [allKeysLoaded, keys]) // Add keys as dependency

  // Debounce pattern search
  useEffect(() => {
    const timer = setTimeout(loadKeys, 300)
    return () => clearTimeout(timer)
  }, [searchPattern, loadKeys])

  // Load more data manually
  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || allKeysLoaded) return
    loadingMoreRef.current = true
    setVisibleCount(prev => prev + 50)

    setTimeout(() => {
      loadingMoreRef.current = false
    }, 100)
  }, [allKeysLoaded])

  const toggleKey = (keyName: string) => {
    setKeys(keys.map(key =>
      key.name === keyName ? { ...key, checked: !key.checked } : key
    ))
  }

  const handleSelectAll = () => {
    const newState = !selectAll
    setSelectAll(newState)
    setKeys(keys.map(key => ({ ...key, checked: newState })))
  }

  const getSelectedCount = () => keys.filter(k => k.checked).length

  /**
   * 转换并美化导出数据
   * 根据 Redis 数据类型对数据进行反序列化和格式化处理
   * 包括 Java 序列化对象的特殊处理
   */
  const prettifyExportData = async (keyInfo: KeyInfo, rawData: any, encoding?: string): Promise<any> => {
    const { type, name } = keyInfo

    // 处理 Java 序列化对象
    if (encoding === 'java-binary' && Array.isArray(rawData)) {
      try {
        // 尝试使用 Java 反序列化
        if (window.electronAPI?.javaDeserialize) {
          const result = await window.electronAPI.javaDeserialize(rawData)
          if (result.success && result.data) {
            return {
              type: 'Java Object',
              className: result.data?.className,
              data: result.data
            }
          }
        }
        // 如果反序列化失败，返回字节数组信息
        return {
          type: 'Java Serialized (Binary)',
          byteCount: rawData.length,
          data: rawData
        }
      } catch (error) {
        return {
          type: 'Java Serialized (Error)',
          error: error instanceof Error ? error.message : 'Unknown error',
          byteCount: rawData.length
        }
      }
    }

    // String 类型 - 尝试解析 JSON 并格式化
    if (type === 'string') {
      if (typeof rawData !== 'string') {
        return rawData
      }
      try {
        const trimmed = rawData.trim()
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          const parsed = JSON.parse(trimmed)
          return customStringify(parsed, 2)
        }
        return rawData // 普通字符串保持原样
      } catch (e) {
        return rawData // 解析失败保持原样
      }
    }

    // Hash 类型 - 对每个字段的值进行反序列化
    if (type === 'hash' && typeof rawData === 'object' && rawData !== null && !Array.isArray(rawData)) {
      const prettifiedHash: Record<string, any> = {}
      for (const [field, value] of Object.entries(rawData)) {
        if (typeof value !== 'string') {
          prettifiedHash[field] = value
          continue
        }
        try {
          const valueStr = value.trim()
          if ((valueStr.startsWith('{') && valueStr.endsWith('}')) ||
              (valueStr.startsWith('[') && valueStr.endsWith(']'))) {
            prettifiedHash[field] = JSON.parse(valueStr)
          } else {
            prettifiedHash[field] = value
          }
        } catch (e) {
          prettifiedHash[field] = value // 解析失败保持原值
        }
      }
      return prettifiedHash
    }

    // List 类型 - 对每个元素进行反序列化
    if (type === 'list' && Array.isArray(rawData)) {
      return rawData.map(item => {
        if (typeof item !== 'string') return item
        try {
          const itemStr = item.trim()
          if ((itemStr.startsWith('{') && itemStr.endsWith('}')) ||
              (itemStr.startsWith('[') && itemStr.endsWith(']'))) {
            return JSON.parse(itemStr)
          }
          return item
        } catch (e) {
          return item // 解析失败保持原值
        }
      })
    }

    // Set 类型 - 对每个元素进行反序列化
    if (type === 'set' && Array.isArray(rawData)) {
      return rawData.map(item => {
        if (typeof item !== 'string') return item
        try {
          const itemStr = item.trim()
          if ((itemStr.startsWith('{') && itemStr.endsWith('}')) ||
              (itemStr.startsWith('[') && itemStr.endsWith(']'))) {
            return JSON.parse(itemStr)
          }
          return item
        } catch (e) {
          return item // 解析失败保持原值
        }
      })
    }

    // ZSet 类型 - 反序列化分数对应的数据
    if (type === 'zset' && Array.isArray(rawData)) {
      return rawData.map((item) => {
        // ZSet items are objects with member and score
        if (typeof item === 'object' && item !== null && 'member' in item) {
          if (typeof item.member !== 'string') return item
          try {
            const itemStr = item.member.trim()
            if ((itemStr.startsWith('{') && itemStr.endsWith('}')) ||
                (itemStr.startsWith('[') && itemStr.endsWith(']'))) {
              return { ...item, member: JSON.parse(itemStr) }
            }
            return item
          } catch (e) {
            return item // 解析失败保持原值
          }
        }
        return item
      })
    }

    return rawData
  }

  const handleExport = async () => {
    const selectedKeys = keys.filter(k => k.checked)
    if (selectedKeys.length === 0) return

    setExporting(true)
    setExportResults({ exported: 0, skipped: 0 })

    const exportData: Record<string, any> = {}
    let exportedCount = 0

    try {
      for (const key of selectedKeys) {
        try {
          if (window.electronAPI?.redisGet) {
            const result = await window.electronAPI.redisGet(connectionId!, key.name) as RedisGetResult
            if (result.success) {
              // 使用美化函数处理数据（包括 Java 反序列化）
              const prettifiedData = await prettifyExportData(
                key,
                result.data,
                result.encoding
              )
              exportData[key.name] = {
                type: key.type,
                encoding: result.encoding,
                data: prettifiedData,
              }
              exportedCount++
            } else {
            }
          }
        } catch (error) {
        }
      }

      setExportResults({
        exported: exportedCount,
        skipped: selectedKeys.length - exportedCount,
      })

      // Download the file
      if (exportedCount > 0) {
        if (exportMode === 'single') {
          // 合并导出为一个文档
          downloadFile(exportData, exportFormat)
        } else {
          // 导出为压缩包，每个 key 单独一个文件
          downloadArchive(exportData, exportFormat)
        }
      }
    } catch (error) {
      setExportResults({
        exported: 0,
        skipped: selectedKeys.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setExporting(false)
    }
  }

  const downloadFile = (data: Record<string, any>, format: ExportFormat) => {
    let content: string
    let mimeType: string
    let filename: string

    if (format === 'json') {
      content = JSON.stringify(data, null, 2)
      mimeType = 'application/json'
      filename = `redis-export-${Date.now()}.json`
    } else if (format === 'csv') {
      content = convertToCSV(data)
      mimeType = 'text/csv'
      filename = `redis-export-${Date.now()}.csv`
    } else {
      content = convertToTXT(data)
      mimeType = 'text/plain'
      filename = `redis-export-${Date.now()}.txt`
    }

    // Create blob and download
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导出为压缩包（每个 key 单独一个文件）
  const downloadArchive = async (data: Record<string, any>, format: ExportFormat) => {
    try {
      // 使用 electron API 创建并下载压缩包
      if (!window.electronAPI?.createAndDownloadArchive) {
        // Fallback: 下载单个文件
        downloadFile(data, format)
        return
      }

      const files: { name: string; content: string }[] = []

      for (const [key, value] of Object.entries(data)) {
        // 生成安全的文件名（替换特殊字符）
        const safeName = key.replace(/[^a-zA-Z0-9\-_.]/g, '_')
        let content: string
        let extension: string

        if (format === 'json') {
          // 对于单个 key，格式化为单条数据
          const singleData = {
            key: key,
            type: value.type,
            encoding: value.encoding,
            data: value.data
          }
          content = JSON.stringify(singleData, null, 2)
          extension = 'json'
        } else if (format === 'csv') {
          // 单个 key 导出为 CSV
          const escapedKey = CSVEscape(key)
          const escapedType = CSVEscape(value.type)
          const escapedEncoding = CSVEscape(value.encoding || 'unknown')
          let escapedValue = ''

          if (typeof value.data === 'string') {
            escapedValue = CSVEscape(value.data)
          } else if (Array.isArray(value.data)) {
            escapedValue = CSVEscape(customStringify(value.data, 2))
          } else {
            escapedValue = CSVEscape(customStringify(value.data, 2))
          }

          content = `Key,Type,Encoding,Value\n${escapedKey},${escapedType},${escapedEncoding},${escapedValue}`
          extension = 'csv'
        } else {
          // 单个 key 导出为 TXT
          const lines: string[] = []
          lines.push(`Key: ${key}`)
          lines.push(`Type: ${value.type}`)
          if (value.encoding) {
            lines.push(`Encoding: ${value.encoding}`)
          }

          if (typeof value.data === 'string') {
            lines.push(`Value: ${value.data}`)
          } else if (Array.isArray(value.data)) {
            lines.push('Value:')
            value.data.forEach((item, i) => {
              lines.push(`  [${i}]: ${customStringify(item, 2)}`)
            })
          } else if (typeof value.data === 'object' && value.data !== null) {
            if (value.data.type === 'Java Object' && value.data.className) {
              lines.push(`Java Class: ${value.data.className}`)
              lines.push('Value:')
              if (value.data.data && typeof value.data.data === 'object') {
                const javaFormatted = customStringify(value.data.data, 2)
                javaFormatted.split('\n').forEach(line => {
                  lines.push(`  ${line}`)
                })
              }
            } else {
              lines.push('Value:')
              const formatted = customStringify(value.data, 2)
              formatted.split('\n').forEach(line => {
                lines.push(`  ${line}`)
              })
            }
          } else {
            lines.push(`Value: ${JSON.stringify(value.data, null, 2)}`)
          }

          content = lines.join('\n')
          extension = 'txt'
        }

        files.push({
          name: `${safeName}.${extension}`,
          content
        })
      }

      // 调用 electron API 创建并下载压缩包
      const archiveResult = await window.electronAPI.createAndDownloadArchive({
        filename: `redis-export-${Date.now()}.zip`,
        files
      })

      if (!archiveResult.success) {
        throw new Error(archiveResult.error || 'Failed to create archive')
      }
    } catch (error) {
      // Fallback: 下载单个文件
      downloadFile(data, format)
    }
  }

  const convertToCSV = (data: Record<string, any>): string => {
    const rows: string[] = ['Key,Type,Encoding,Value']

    for (const [key, value] of Object.entries(data)) {
      const escapedKey = CSVEscape(key)
      const escapedType = CSVEscape(value.type)
      const escapedEncoding = CSVEscape(value.encoding || 'unknown')
      let escapedValue = ''

      // 根据数据类型格式化值用于 CSV
      if (typeof value.data === 'string') {
        escapedValue = CSVEscape(value.data)
      } else if (Array.isArray(value.data)) {
        // 对于数组，使用格式化的 JSON 字符串
        escapedValue = CSVEscape(customStringify(value.data, 2))
      } else {
        // 对于对象（包括 Java 对象格式化后的数据），使用格式化的 JSON 字符串
        escapedValue = CSVEscape(customStringify(value.data, 2))
      }

      rows.push(`${escapedKey},${escapedType},${escapedEncoding},${escapedValue}`)
    }

    return rows.join('\n')
  }

  const CSVEscape = (str: string): string => {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const convertToTXT = (data: Record<string, any>): string => {
    const lines: string[] = []
    lines.push(`Redis Data Export`)
    lines.push(`Exported: ${new Date().toISOString()}`)
    lines.push(`Total Keys: ${Object.keys(data).length}`)
    lines.push('='.repeat(50))
    lines.push('')

    for (const [key, value] of Object.entries(data)) {
      lines.push(`Key: ${key}`)
      lines.push(`Type: ${value.type}`)
      if (value.encoding) {
        lines.push(`Encoding: ${value.encoding}`)
      }

      if (typeof value.data === 'string') {
        lines.push(`Value: ${value.data}`)
      } else if (Array.isArray(value.data)) {
        lines.push('Value:')
        value.data.forEach((item, i) => {
          lines.push(`  [${i}]: ${customStringify(item, 2)}`)
        })
      } else if (typeof value.data === 'object' && value.data !== null) {
        // 处理 Java 对象格式化后的数据
        if (value.data.type === 'Java Object' && value.data.className) {
          lines.push(`Java Class: ${value.data.className}`)
          lines.push('Value:')
          if (value.data.data && typeof value.data.data === 'object') {
            const javaFormatted = customStringify(value.data.data, 2)
            javaFormatted.split('\n').forEach(line => {
              lines.push(`  ${line}`)
            })
          }
        } else {
          lines.push('Value:')
          const formatted = customStringify(value.data, 2)
          formatted.split('\n').forEach(line => {
            lines.push(`  ${line}`)
          })
        }
      } else {
        lines.push(`Value: ${JSON.stringify(value.data, null, 2)}`)
      }

      lines.push('-'.repeat(30))
      lines.push('')
    }

    return lines.join('\n')
  }

  const clearResults = () => {
    setExportResults(null)
  }

  if (!connectionId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <p className="text-gray-400 dark:text-gray-500 text-sm">Please connect to server to export data</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Pattern Input */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Pattern:</label>
          <div className="w-48 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
            <input
              type="text"
              value={searchPattern}
              onChange={(e) => setSearchPattern(e.target.value)}
              placeholder="* (e.g., user:*, cache:*)"
              className="flex-1 min-w-0 px-2 py-1 text-xs bg-transparent text-gray-900 dark:text-white focus:outline-none"
            />
            <button
              onClick={loadKeys}
              disabled={loading}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              title="Refresh keys"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Select All */}
      <div className="flex-shrink-0 h-10 px-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between opacity-80">
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {selectAll ? (
            <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />
          ) : (
            <Square className="w-4 h-4 shrink-0" />
          )}
          {selectAll ? 'Deselect All' : 'Select All'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {getSelectedCount()} selected
          </span>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {keys.length} keys
          </span>

          {/* Export Format & Action Buttons */}
          <div className="flex items-center gap-3 ml-2">
            {/* Export Mode Tabs */}
            <div className="flex items-center border-b border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setExportMode('single')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  exportMode === 'single'
                    ? 'text-blue-600 dark:text-blue-400 border-blue-500'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Single
              </button>
              <button
                onClick={() => setExportMode('archive')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  exportMode === 'archive'
                    ? 'text-purple-600 dark:text-purple-400 border-purple-500'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Archive
              </button>
            </div>

            {/* Format Tabs */}
            <div className="flex items-center border-b border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setExportFormat('json')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  exportFormat === 'json'
                    ? 'text-green-600 dark:text-green-400 border-green-500'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                JSON
              </button>
              <button
                onClick={() => setExportFormat('csv')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  exportFormat === 'csv'
                    ? 'text-green-600 dark:text-green-400 border-green-500'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                CSV
              </button>
              <button
                onClick={() => setExportFormat('txt')}
                className={`px-3 py-1 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  exportFormat === 'txt'
                    ? 'text-green-600 dark:text-green-400 border-green-500'
                    : 'text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                TXT
              </button>
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={getSelectedCount() === 0 || exporting}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors bg-red-500 hover:bg-red-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {exporting ? (
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <Download className="w-3 h-3 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Key List */}
      <div className="px-3 overflow-hidden flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm min-h-[200px]">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : visibleKeys.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm min-h-[200px]">
            No keys found matching pattern "{searchPattern}"
          </div>
        ) : (
          <div className="flex flex-col border border-transparent rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 201.5px)' }}>
            {/* Fixed Header */}
            <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-b border-black/10 dark:border-white/10">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col />
                  <col style={{ width: '80px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400"></th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Key</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-gray-600 dark:text-gray-400">Type</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body - auto fill remaining space */}
            <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" onScroll={(e) => {
              const target = e.target as HTMLDivElement
              const { scrollTop, scrollHeight, clientHeight } = target
              const distanceToBottom = scrollHeight - scrollTop - clientHeight

              if (allKeysLoaded || loadingMoreRef.current) return

              if (distanceToBottom < 200) {
                loadingMoreRef.current = true
                setVisibleCount(prev => prev + 50)
                setTimeout(() => {
                  loadingMoreRef.current = false
                }, 100)
              }
            }}>
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col />
                  <col style={{ width: '80px' }} />
                </colgroup>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {visibleKeys.map((key) => (
                    <tr
                      key={key.name}
                      onClick={() => !exporting && toggleKey(key.name)}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                        key.checked ? 'bg-green-50 dark:bg-green-900/20' : ''
                      }`}
                    >
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={key.checked}
                          readOnly
                          className="w-4 h-4 accent-green-500 cursor-pointer shrink-0"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate" title={key.name}>
                          {key.name}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium inline-block ${
                          key.type === 'string'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : key.type === 'hash'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : key.type === 'list'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                            : key.type === 'set'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'
                        }`}>
                          {key.type.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            <div className="flex-shrink-0 px-3 py-0 bg-gray-50 dark:bg-gray-900/10 border-t border-black/10 dark:border-white/10 h-8 flex items-center">
              <button
                onClick={handleLoadMore}
                disabled={allKeysLoaded || loadingMoreRef.current}
                className="w-full h-6 text-xs text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-transparent dark:hover:bg-transparent disabled:text-gray-400 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors flex items-center justify-center"
              >
                {loadingMoreRef.current ? 'Loading...' : allKeysLoaded ? `All loaded (${keys.length})` : `Load More (${visibleKeys.length}/${keys.length})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 h-[52px] px-3 border-t border-black/10 dark:border-white/10 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        {exporting && (
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Exporting... {exportResults?.exported || 0} / {getSelectedCount()}</span>
          </div>
        )}
        {!exporting && exportResults && (
          <div className="flex items-center gap-2 text-xs">
            {exportResults.exported > 0 ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  Exported {exportResults.exported} key{exportResults.exported !== 1 ? 's' : ''}
                </span>
              </>
            ) : (
              <span className="text-red-600 dark:text-red-400">
                {exportResults.error || 'Export failed'}
              </span>
            )}
            <button
              onClick={clearResults}
              className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {!exporting && !exportResults && (
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>{keys.length} total keys</span>
            {allKeysLoaded && <span className="flex items-center gap-1">✓ All loaded</span>}
          </div>
        )}
      </div>
    </div>
  )
}