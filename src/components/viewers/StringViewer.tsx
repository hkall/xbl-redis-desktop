import React, { useEffect, useState, useMemo } from 'react'
import { ChevronDown, Save } from 'lucide-react'
import {
  deserializeData,
  formatDataForDisplay as formatDeserializedData,
  getDeserializationOptions,
  isLikelyBinary,
} from '@/utils/deserializer'
import { formatDataForEdit } from '@/utils/formatter'
import JavaObjectViewer from './JavaObjectViewer'
import CodeEditor from '../CodeEditor'

export interface StringViewerProps {
  connectionId: string | null
  keyName: string
}

export interface DisplayResult {
  displayValue: string
  error: string | null
  parsedData: any
  isJavaBinary: boolean
}

export default function StringViewer({ connectionId, keyName }: StringViewerProps) {
  const [value, setValue] = useState<string | null>(null)
  const [editing, setEditing] = useState<boolean>(false)
  const [editValue, setEditValue] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [format, setFormat] = useState<string>('auto')
  const [showFormatMenu, setShowFormatMenu] = useState<boolean>(false)
  const [deserializationError, setDeserializationError] = useState<string | null>(null)
  const [javaByteArray, setJavaByteArray] = useState<number[] | null>(null)

  useEffect(() => {
    loadKey()
  }, [connectionId, keyName])

  const loadKey = async () => {
    if (!connectionId || !keyName) return

    setLoading(true)
    try {
      if (window.electronAPI && window.electronAPI.redisGet) {
        const result = await window.electronAPI.redisGet(connectionId, keyName)

        if (result.success && result.data !== undefined) {
          const encoding = result.encoding || 'unknown'
          const data = result.data

          if (encoding === 'java-binary' && Array.isArray(data)) {
            setJavaByteArray(data)
            setValue(null)
            setEditValue(JSON.stringify(data, null, 2))
          } else if (typeof data === 'string' && encoding === 'base64') {
            const binaryString = atob(data)
            setValue(binaryString)
            setEditValue(binaryString)
          } else {
            setValue(data as string)
            setEditValue(data as string)
          }
        }
      }
    } catch (error) {
      // Error already handled by UI state
    } finally {
      setLoading(false)
    }
  }

  const formatOptions = getDeserializationOptions()

  const handleSave = async () => {
    if (!connectionId || !keyName) return

    setSaving(true)
    try {
      const result = await window.electronAPI.redisSet(
        connectionId,
        keyName,
        'string',
        editValue
      )
      if (result.success) {
        setValue(editValue)
        setEditing(false)
      }
    } catch (error) {
      // Error already handled by UI state
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab 键支持缩进（两个空格）
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = editValue.substring(0, start) + '  ' + editValue.substring(end)
      setEditValue(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
      return
    }

    // Ctrl+Enter 或 Cmd+Enter 保存
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      return
    }
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setEditing(false)
  }

  const handleStartEdit = () => {
    const formattedEditValue = formatDataForEdit(value)
    setEditValue(formattedEditValue)
    setEditing(true)
  }

  const displayResult: DisplayResult = useMemo(() => {
    if (!value && !javaByteArray) {
      return { displayValue: '', error: null, parsedData: null, isJavaBinary: false }
    }

    // If it's Java binary data, no deserialization needed - handled by JavaObjectViewer
    if (javaByteArray) {
      return { displayValue: '', error: null, parsedData: null, isJavaBinary: true }
    }

    if (!value) {
      return { displayValue: '', error: null, parsedData: null, isJavaBinary: false }
    }

    // Try to deserialize based on selected format
    try {
      const deserialResult = deserializeData(value, format as any)
      if (deserialResult.success) {
        // Convert to string for display
        let displayValue: string
        if (typeof deserialResult.data === 'string') {
          displayValue = deserialResult.data
        } else {
          // For objects (like parsed JSON), stringify with proper formatting
          // 转义字符串值中的换行符，避免它们被当作实际的换行显示
          const replacer = (_key: string, val: any) => {
            if (typeof val === 'bigint') return val.toString()
            if (typeof val === 'string') {
              // 将实际的换行符转义为 \n 显示，并在 JSON.stringify 后再转义
              return val.replace(/\r\n/g, '\r\n').replace(/\n/g, '\n').replace(/\r/g, '\r')
            }
            return val
          }
          displayValue = JSON.stringify(deserialResult.data, replacer, 2)
        }
        return { displayValue, error: null, parsedData: deserialResult.data, isJavaBinary: false }
      } else {
        return { displayValue: value, error: deserialResult.error || null, parsedData: null, isJavaBinary: false }
      }
    } catch (e) {
      return { displayValue: value, error: e instanceof Error ? e.message : 'Unknown error', parsedData: null, isJavaBinary: false }
    }
  }, [value, javaByteArray, format])

  const { displayValue, error, isJavaBinary } = displayResult

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0">
      {/* Header with format selector - matching other viewers */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Java Serialized indicator - other info shown in JavaObjectViewer */}
          {javaByteArray ? (
            <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded font-medium flex-shrink-0">
              Java Serialized
            </span>
          ) : value ? (
            <>
              {/* Format selector dropdown */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowFormatMenu(!showFormatMenu)}
                  className="flex items-center gap-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded transition-colors"
                  title="Select Data Format"
                >
                  <span>Format</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {showFormatMenu && (
                  <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-[140px]">
                    {formatOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setFormat(option.value)
                          setShowFormatMenu(false)
                          setDeserializationError(null)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        format === option.value
                          ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Show current format badge */}
              <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${
                format === 'auto'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : format === 'json'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : format === 'base64'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : format === 'hex'
                  ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400'
                  : format === 'url'
                  ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {format === 'url' ? 'URL' : format.toUpperCase()}
              </span>
            </>
          ) : null}
        </div>

        {!editing && !javaByteArray && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => {
                handleStartEdit()
                setShowFormatMenu(false)
              }}
              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0 font-medium"
            >
              <Save className="w-3 h-3" />
              编辑
            </button>
          </div>
        )}

        {editing && (
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 font-medium"
            >
              <Save className="w-3 h-3 flex-shrink-0" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="text-xs border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* Editor/View area */}
      {editing ? (
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-2 flex flex-col">
          {/* Edit info bar */}
          <div className="flex-shrink-0 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-400">
              编辑原始数据 - 更改将直接保存到 Redis
            </p>
          </div>
          {/* Editor container */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeEditor
              value={editValue}
              onChange={setEditValue}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-full"
            />
          </div>
          {/* Keyboard shortcuts hint */}
          <div className="flex-shrink-0 mt-2 text-xs text-gray-400 dark:text-gray-500">
            Tab 缩进 · Ctrl+Enter 保存
          </div>
        </div>
      ) : javaByteArray ? (
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-2">
          <JavaObjectViewer byteArray={javaByteArray} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden px-4 pb-2 flex flex-col">
          {/* Warning and Error messages */}
          {(format === 'raw' && !error && value && isLikelyBinary(value)) || error ? (
            <div className="flex-shrink-0 mb-2">
              {format === 'raw' && !error && value && isLikelyBinary(value) && (
                <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-xs text-yellow-800 dark:text-yellow-400">
                    数据似乎包含二进制字符。尝试使用 Base64 或 Hex 格式来解码。
                  </p>
                </div>
              )}
              {error && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-xs text-red-800 dark:text-red-400">
                    {error} - 显示原始数据
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Read-only viewer */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <CodeEditor
              value={displayValue || '<empty>'}
              onChange={() => {}}
              readOnly
              className="h-full text-sm"
              editorKey={keyName}
            />
          </div>
        </div>
      )}
    </div>
  )
}