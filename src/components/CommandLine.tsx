import React, { useState, useEffect, useRef } from 'react'
import { Terminal, Send, ChevronUp, ChevronDown, X, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'

interface CommandHistory {
  command: string
  timestamp: number
}

interface OutputItem {
  type: 'command' | 'result' | 'error'
  content: string
  data?: any
  formatted?: boolean
}

interface CommandLineProps {
  connectionId: string | null
}

// Common Redis commands for autocomplete
const REDIS_COMMANDS = [
  'GET', 'SET', 'DEL', 'EXISTS', 'KEYS', 'SCAN', 'TYPE', 'TTL', 'EXPIRE', 'PERSIST',
  'HGET', 'HSET', 'HMGET', 'HMSET', 'HGETALL', 'HDEL', 'HKEYS', 'HVALS', 'HLEN',
  'LPUSH', 'RPUSH', 'LPOP', 'RPOP', 'LRANGE', 'LLEN', 'LINDEX', 'LSET', 'LREM',
  'SADD', 'SREM', 'SMEMBERS', 'SISMEMBER', 'SCARD', 'SPOP', 'SRANDMEMBER',
  'ZADD', 'ZREM', 'ZRANGE', 'ZSCORE', 'ZRANK', 'ZCARD', 'ZCOUNT', 'ZINCRBY',
  'INCR', 'DECR', 'INCRBY', 'DECRBY', 'INCRBYFLOAT',
  'APPEND', 'STRLEN', 'GETRANGE', 'SETRANGE',
  'INFO', 'PING', 'ECHO', 'DBSIZE', 'FLUSHDB', 'FLUSHALL',
  'SELECT', 'MOVE', 'RENAME', 'RENAMENX',
  'EXPIREAT', 'PEXPIRE', 'PEXPIREAT', 'PTTL',
  'SUBSCRIBE', 'UNSUBSCRIBE', 'PUBLISH', 'PSUBSCRIBE', 'PUNSUBSCRIBE',
  'MULTI', 'EXEC', 'DISCARD',
  'WATCH', 'UNWATCH',
]

export default function CommandLine({ connectionId }: CommandLineProps) {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<CommandHistory[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [output, setOutput] = useState<OutputItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteIndex, setAutocompleteIndex] = useState(0)
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([])
  const [confirmClear, setConfirmClear] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('redis-command-history')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setHistory(parsed)
        setOutput([{ type: 'command', content: 'Command line ready. Type a Redis command to execute.' }])
      } catch {
        setOutput([{ type: 'command', content: 'Command line ready. Type a Redis command to execute.' }])
      }
    } else {
      setOutput([{ type: 'command', content: 'Command line ready. Type a Redis command to execute.' }])
    }
  }, [])

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('redis-command-history', JSON.stringify(history))
    }
  }, [history])

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter to execute command
    if (e.key === 'Enter') {
      e.preventDefault()
      handleExecute()
      return
    }

    // Handle autocomplete
    if (e.key === 'Tab' && autocompleteSuggestions.length > 0) {
      e.preventDefault()
      const match = command.match(/^([A-Z]+)/i)
      if (match) {
        const prefix = match[0]
        const suggestion = autocompleteSuggestions[autocompleteIndex] || autocompleteSuggestions[0]
        setCommand(suggestion + command.slice(prefix.length))
      }
    }

    // Up arrow: navigate history
    if (e.key === 'ArrowUp') {
      if (e.ctrlKey || showAutocomplete) {
        e.preventDefault()
        if (autocompleteIndex > 0) {
          setAutocompleteIndex(autocompleteIndex - 1)
        }
      } else {
        e.preventDefault()
        if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1
          setHistoryIndex(newIndex)
          setCommand(history[history.length - 1 - newIndex].command)
        }
      }
    }

    // Down arrow: navigate history forward
    if (e.key === 'ArrowDown') {
      if (e.ctrlKey || showAutocomplete) {
        e.preventDefault()
        if (autocompleteIndex < autocompleteSuggestions.length - 1) {
          setAutocompleteIndex(autocompleteIndex + 1)
        }
      } else {
        e.preventDefault()
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1
          setHistoryIndex(newIndex)
          setCommand(history[history.length - 1 - newIndex].command)
        } else if (historyIndex === 0) {
          setHistoryIndex(-1)
          setCommand('')
        }
      }
    }

    // Escape: hide autocomplete
    if (e.key === 'Escape') {
      setShowAutocomplete(false)
      showHistory && setShowHistory(false)
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setCommand(value)

    // Show autocomplete for commands
    const match = value.match(/^([^ ]*)/i)
    if (match && match[1] && match[1].length > 0) {
      const suggestions = REDIS_COMMANDS.filter(cmd =>
        cmd.toLowerCase().startsWith(match[1].toLowerCase())
      )
      setAutocompleteSuggestions(suggestions)
      setAutocompleteIndex(0)
      setShowAutocomplete(suggestions.length > 0 && suggestions.length < 10)
    } else {
      setShowAutocomplete(false)
    }
  }

  // Execute command
  const handleExecute = async () => {
    const trimmed = command.trim()
    if (!trimmed) return

    if (!connectionId) {
      appendOutput('error', 'Not connected to Redis server')
      return
    }

    setLoading(true)
    const cmdToExecute = trimmed

    // Add to history
    const newHistory: CommandHistory = {
      command: cmdToExecute,
      timestamp: Date.now()
    }
    setHistory(prev => [...prev.slice(-100), newHistory])
    appendOutput('command', `> ${cmdToExecute}`)

    try {
      if (window.electronAPI?.redisExecuteCommand) {
        const result = await window.electronAPI.redisExecuteCommand(connectionId, cmdToExecute)

        if (result.success) {
          // Log the result for debugging
          console.log('CLI Command Result:', { encoding: result.encoding, dataType: typeof result.data, isArray: Array.isArray(result.data), dataSample: result.data })

          // Check for encoding field (Java binary data)
          const encoding = result.encoding
          const data = result.data

          // If it's Java binary data, deserialize it
          if (encoding === 'java-binary' && Array.isArray(data)) {
            console.log('CLI: Detected Java binary data, attempting deserialization...')
            try {
              if (window.electronAPI?.javaDeserialize) {
                const deserialized = await window.electronAPI.javaDeserialize(data)
                console.log('CLI: Deserialization result:', deserialized)
                if (deserialized.success && deserialized.data) {
                  const message = `[Java Object: ${deserialized.data?.className || 'Unknown'}]`
                  console.log('CLI: Displaying Java object:', message)
                  appendOutput('result', message, deserialized.data)
                } else {
                  console.log('CLI: Deserialization failed, showing binary data')
                  appendOutput('result', `[Binary data: ${data.length} bytes]`, { byteArray: data })
                }
              } else {
                console.log('CLI: javaDeserialize API not available')
                appendOutput('result', `[Binary data: ${data.length} bytes]`, { byteArray: data })
              }
            } catch (error) {
              console.error('CLI: Deserialization error:', error)
              appendOutput('result', `[Binary data: ${data.length} bytes]`, { byteArray: data })
            }
          } else {
            console.log('CLI: Formatting regular output...')
            // Format regular output
            const formatted = await formatOutput(data)
            appendOutput('result', formatted.text, formatted.data)
          }
        } else {
          appendOutput('error', result.error || 'Command execution failed')
        }
      } else {
        // Browser mode - simulate
        appendOutput('result', 'Browser mode: command execution simulated')
      }
    } catch (error) {
      console.error('CLI: Execute error:', error)
      appendOutput('error', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
      setCommand('')
      setHistoryIndex(-1)
      setShowAutocomplete(false)
    }
  }

  // Format output for display
  const formatOutput = async (data: any): Promise<{ text: string; data?: any; formatted: boolean }> => {
    console.log('formatOutput called with:', data, 'type:', typeof data)

    if (data === null) {
      console.log('formatOutput: data is null, returning (nil)')
      return { text: '(nil)', formatted: false }
    }

    if (data === undefined) {
      console.log('formatOutput: data is undefined, returning (nil)')
      return { text: '(nil)', formatted: false }
    }

    // Handle byte array (from Redis GET with java-binary encoding)
    if (Array.isArray(data) && data.every(item => typeof item === 'number')) {
      try {
        if (window.electronAPI?.javaDeserialize) {
          const result = await window.electronAPI.javaDeserialize(data)
          if (result.success && result.data) {
            return {
              text: `[Java Object: ${result.data?.className || 'Unknown'}]`,
              data: result.data,
              formatted: true
            }
          }
        }
      } catch (error) {
        // Fall through to regular display
      }
      return { text: `[Binary data: ${data.length} bytes]`, data, formatted: false }
    }

    if (typeof data === 'string') {
      // Check for JSON strings
      const trimmed = data.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(data)
          return {
            text: data,
            data: parsed,
            formatted: true
          }
        } catch {
          // Not valid JSON
        }
      }

      return { text: data, formatted: false }
    }

    if (typeof data === 'number') {
      return { text: data.toString(), formatted: false }
    }

    if (typeof data === 'boolean') {
      return { text: data ? '(integer) 1' : '(integer) 0', formatted: false }
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { text: '(empty list)', formatted: false }
      }

      // Check if array contains byte arrays (Java serialized objects)
      const hasByteArrays = data.some(item =>
        Array.isArray(item) && item.every((val: any) => typeof val === 'number')
      )

      if (hasByteArrays) {
        try {
          const deserializedItems = await Promise.all(
            data.map(async (item: any, index: number) => {
              if (Array.isArray(item) && item.every((val: any) => typeof val === 'number')) {
                if (window.electronAPI?.javaDeserialize) {
                  const result = await window.electronAPI.javaDeserialize(item)
                  if (result.success && result.data) {
                    return {
                      index,
                      className: result.data?.className || 'Unknown',
                      data: result.data
                    }
                  }
                }
              }
              return { index, data: item }
            })
          )

          return {
            text: `[${deserializedItems.length} item(s)]`,
            data: deserializedItems,
            formatted: true
          }
        } catch (error) {
          // Fall through to regular array display
        }
      }

      return {
        text: data.map((item, i) => `${i + 1}) "${item}"`).join('\n'),
        data,
        formatted: false
      }
    }

    if (typeof data === 'object') {
      return { text: JSON.stringify(data, null, 2), data, formatted: true }
    }

    return { text: String(data), formatted: false }
  }

  // Format individual item for display
  const formatJsonDisplay = (item: any): string => {
    if (item === null || item === undefined) return '(nil)'
    if (typeof item === 'object') return JSON.stringify(item, null, 2)
    return String(item)
  }

  // Format Java object data for display
  const formatJavaObject = (obj: any): string => {
    if (!obj) return ''

    if (obj.className && obj.serialVersionUid !== undefined) {
      const lines: string[] = []
      lines.push(`Class: ${obj.className}`)
      lines.push(`SerialVersionUID: ${obj.serialVersionUid}`)

      if (obj.value && typeof obj.value === 'object') {
        Object.entries(obj.value).forEach(([key, value]) => {
          lines.push(`  ${key}: ${formatJsonDisplay(value)}`)
        })
      }

      return lines.join('\n')
    }

    return JSON.stringify(obj, null, 2)
  }

  // Append output to the display
  const appendOutput = (type: 'command' | 'result' | 'error', content: string, data?: any) => {
    setOutput(prev => [...prev.slice(-500), { type, content, data }])
  }

  // Clear output
  const clearOutput = () => {
    setOutput([{ type: 'command', content: 'Output cleared.' }])
  }

  // Clear history
  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem('redis-command-history')
    setConfirmClear(false)
  }

  // Apply autocomplete
  const applyAutocomplete = (suggestion: string) => {
    const match = command.match(/^([A-Z]+)/i)
    if (match) {
      setCommand(suggestion + command.slice(match[0].length))
    } else {
      setCommand(suggestion + ' ')
    }
    setShowAutocomplete(false)
    inputRef.current?.focus()
  }

  // Apply history
  const applyHistory = (item: CommandHistory) => {
    setCommand(item.command)
    setShowHistory(false)
    setHistoryIndex(0)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Content */}
      {!connectionId ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">Please connect to a Redis server first</p>
        </div>
      ) : (
        <div className="w-full h-full bg-gray-900 dark:bg-black flex flex-col rounded-lg overflow-hidden font-mono text-sm">
          {/* Header */}
          <div className="flex-shrink-0 px-3 py-2 bg-gray-800 dark:bg-gray-950 border-b border-black/10 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-red-500" />
              <span className="text-gray-300 font-medium">Redis CLI</span>
              {history.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-gray-400 hover:text-gray-300 text-xs"
                >
                  History ({history.length})
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setConfirmClear(true)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                title="Clear history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={clearOutput}
                className="p-1.5 text-gray-400 hover:text-gray-300 transition-colors"
                title="Clear output"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

      {/* History panel */}
      {showHistory && (
        <div className="flex-shrink-0 bg-gray-800 dark:bg-gray-950 border-b border-black/10 dark:border-white/10 p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">Command History</span>
            <button
              onClick={() => setShowHistory(false)}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {[...history].reverse().map((item, index) => (
              <button
                key={index}
                onClick={() => applyHistory(item)}
                className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded truncate"
              >
                {item.command}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ minHeight: '150px' }}
      >
        {output.map((item, index) => (
          <div key={index} className="space-y-1">
            {/* Command input */}
            {item.type === 'command' && (
              <div className="text-gray-400 whitespace-pre-wrap break-words">
                {item.content}
              </div>
            )}

            {/* Result output */}
            {item.type === 'result' && (
              <div className="text-green-400">
                {item.data ? (
                  <div className="space-y-1">
                    {/* Summary */}
                    <div className="whitespace-pre-wrap break-words">{item.content}</div>

                    {/* Formatted Java object or structured data */}
                    {Array.isArray(item.data) && item.data.length > 0 && item.data.some((d: any) => d.className) ? (
                      <div className="ml-2 space-y-1 border-l-2 border-green-600 pl-2">
                        {item.data.map((d: any, i: number) => (
                          <div key={i} className="text-xs">
                            <div className="text-yellow-400 font-medium">[{i}] {d.className || 'Unknown'}</div>
                            {d.data && (
                              <pre className="mt-1 text-gray-300 whitespace-pre-wrap break-words">
                                {formatJavaObject(d.data)}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : item.data && typeof item.data === 'object' && item.data.className ? (
                      <pre className="ml-2 mt-1 border-l-2 border-green-600 pl-2 text-xs text-gray-300 whitespace-pre-wrap break-words">
                        {formatJavaObject(item.data)}
                      </pre>
                    ) : typeof item.data === 'string' ? (
                      <pre className="ml-2 mt-1 border-l-2 border-blue-600 pl-2 text-xs text-gray-300 whitespace-pre-wrap break-words">
                        {item.data}
                      </pre>
                    ) : item.data && typeof item.data === 'object' ? (
                      <pre className="ml-2 mt-1 border-l-2 border-green-600 pl-2 text-xs text-gray-300 whitespace-pre-wrap break-words">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words">{item.content}</div>
                )}
              </div>
            )}

            {/* Error output */}
            {item.type === 'error' && (
              <div className="text-red-400 whitespace-pre-wrap break-words">
                {item.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-yellow-400 animate-pulse">Executing...</div>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {showAutocomplete && autocompleteSuggestions.length > 0 && (
        <div className="flex-shrink-0 bg-gray-800 dark:bg-gray-950 border-t border-black/10 dark:border-white/10 p-1">
          <div className="text-xs text-gray-500 mb-1 px-1">Press Tab to autocomplete</div>
          <div className="space-y-0.5">
            {autocompleteSuggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => applyAutocomplete(suggestion)}
                className={`w-full text-left px-2 py-1 text-xs transition-colors ${
                  index === autocompleteIndex
                    ? 'bg-green-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-black/10 dark:border-white/10 h-[52px] flex items-center px-3">
        <div className="flex items-center gap-2 w-full">
          <span className="text-red-500 font-bold">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a Redis command..."
            className="flex-1 bg-transparent text-gray-300 focus:outline-none placeholder-gray-600 py-1"
            disabled={!connectionId || loading}
            autoFocus
          />
          <button
            onClick={handleExecute}
            disabled={!connectionId || loading || !command.trim()}
            className="p-1.5 text-gray-400 hover:text-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Execute command"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 ml-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Enter</kbd>
            <span>Execute</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">Tab</kbd>
            <span>Autocomplete</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-gray-700 rounded">↓</kbd>
            <span>History</span>
          </span>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmClear}
        title="Clear History"
        message="Are you sure you want to clear all command history?"
        confirmText="Clear"
        cancelText="Cancel"
        variant="danger"
        onConfirm={clearHistory}
        onCancel={() => setConfirmClear(false)}
      />
        </div>
      )}
    </div>
  )
}