import { useEffect, useState } from 'react'
import { AlertCircle, Lock } from 'lucide-react'

export interface JavaObjectViewerProps {
  byteArray: number[]
}

export default function JavaObjectViewer({ byteArray }: JavaObjectViewerProps) {
  const [loading, setLoading] = useState<boolean>(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadKey()
  }, [byteArray])

  const loadKey = async () => {
    if (!byteArray || byteArray.length === 0) return

    setLoading(true)
    setError(null)
    setData(null)

    try {
      if (window.electronAPI && window.electronAPI.javaDeserialize) {
        const result = await window.electronAPI.javaDeserialize(byteArray)

        console.log('Java deserialization result:', result)

        if (result.success && result.data) {
          setData(result.data)
        } else {
          setError(result.error || 'Java deserialization failed')
        }
      }
    } catch (e) {
      console.error('Deserialization error:', e)
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Custom JSON stringify with indentation and handling for special types
  function formatJSON(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent)
    const nextSpaces = '  '.repeat(indent + 1)

    if (obj === null) return 'null'
    if (obj === undefined) return 'undefined'

    if (typeof obj === 'string') {
      // Escape special characters in strings
      return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return String(obj)
    }

    if (typeof obj === 'bigint') {
      return `${obj.toString()}n`
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]'
      const items = obj.map(item => formatJSON(item, indent + 1))
      return `[\n${nextSpaces}${items.join(',\n' + nextSpaces)}\n${spaces}]`
    }

    // Handle special objects with type field
    if (obj && typeof obj === 'object') {
      const entries = Object.entries(obj)

      // Handle special wrapped types
      if ('type' in obj && 'value' in obj) {
        if (obj.type === 'bigint') {
          return `${obj.value}n`
        }
        if (obj.type === 'date') {
          return `"${obj.value}"`
        }
      }

      // Handle JavaObject-like structures (className, serialVersionUid, fields, value)
      if (obj.className && obj.serialVersionUid !== undefined) {
        const classInfo = {
          _className: obj.className,
          _serialVersionUID: obj.serialVersionUid,
          ...(obj.value || {})
        }
        const keys = Object.entries(classInfo).map(([key, value]) => [`"${key}"`, formatJSON(value, indent + 1)])

        if (keys.length === 0) return '{}'
        return `{\n${nextSpaces}${keys.map(([k, v]) => `${k}: ${v}`).join(',\n' + nextSpaces)}\n${spaces}}`
      }

      // Regular object
      if (entries.length === 0) return '{}'

      const keys = entries.map(([key, value]) => [`"${key}"`, formatJSON(value, indent + 1)])
      if (keys.length === 0) return '{}'
      return `{\n${nextSpaces}${keys.map(([k, v]) => `${k}: ${v}`).join(',\n' + nextSpaces)}\n${spaces}}`
    }

    return String(obj)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Deserializing</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-red-800 dark:text-red-400 mb-1">Deserialization Error</h3>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header info */}
      {data && (
        <div className="flex items-center gap-2 mb-3 flex-shrink-0 text-xs">
          <span className="text-gray-500 dark:text-gray-400">
            {byteArray.length} bytes
          </span>
          {data.className && (
            <span className="text-gray-600 dark:text-gray-400 truncate font-mono">
              {data.className}
            </span>
          )}
          <span className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Read only
          </span>
        </div>
      )}

      {/* JSON Display */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {data ? (
          <div className="h-full overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg">
            <pre className="p-4 text-sm leading-relaxed">
              <code className="font-mono text-gray-800 dark:text-gray-200 whitespace-pre">
                {formatJSON(data)}
              </code>
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm">No data to display</p>
          </div>
        )}
      </div>
    </div>
  )
}