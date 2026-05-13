import { useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Clock, RefreshCw, CheckCircle2, CheckSquare, Square, AlertCircle } from 'lucide-react'
import { useRedisStore } from '@/store/redisStore'
import { useTranslation } from '@/store/i18nStore'

interface BatchOperationsProps {
  connectionId: string | null
}

interface KeyOption {
  name: string
  type: string
  ttl: number
  size: number
  checked: boolean
}

export default function BatchOperations({ connectionId }: BatchOperationsProps) {
  const { t } = useTranslation()
  const { connections } = useRedisStore()
  const [keys, setKeys] = useState<KeyOption[]>([])
  const [visibleKeys, setVisibleKeys] = useState<KeyOption[]>([])
  const [allScanned, setAllScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchPattern, setSearchPattern] = useState('*')
  const [operationMode] = useState<'delete' | 'ttl'>('delete')
  const [ttlValue, setTtlValue] = useState('')
  const [selectAll, setSelectAll] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [, setResults] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] })

  // Toast notification state
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' })

  // Key loader status
  const [keysFoundCount, setKeysFoundCount] = useState(0)
  const [hasMoreKeys, setHasMoreKeys] = useState(true)

  // Get connection status
  const activeConnection = connectionId
    ? connections.find((c) => c.id === connectionId)
    : null
  const isConnected = activeConnection?.connected || false

  // Table container ref for scroll listening
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)
  const scanCursorRef = useRef('0')

  // Load keys with pagination - like KeyBrowser's SCAN approach
  const loadKeys = useCallback(async (reset = true) => {

    if (!connectionId || !window.electronAPI?.redisScan) {
      return
    }

    if (reset) {
      setLoading(true)
      setKeys([])
      setVisibleKeys([])
      setKeysFoundCount(0)
      setHasMoreKeys(true)
      setAllScanned(false)
      scanCursorRef.current = '0'
      loadingMoreRef.current = false
    } else {
      if (loadingMoreRef.current || !hasMoreKeys) {
        return
      }
    }

    try {
      loadingMoreRef.current = true
      const cursor = scanCursorRef.current

      // Scan with batch size of 20 for better visibility
      const result = await window.electronAPI.redisScan(connectionId, searchPattern, 20, cursor)

      if (result.success && result.data) {
        const newKeyNames = result.data
        scanCursorRef.current = result.cursor || '0'

        // Get key info for each key in this batch
        const keyInfos = await Promise.all(
          newKeyNames.map(async (key) => {
            const infoResult = await window.electronAPI.redisKeyInfo(connectionId, key)
            if (infoResult.success && infoResult.data) {
              return {
                name: infoResult.data.name,
                type: infoResult.data.type,
                ttl: infoResult.data.ttl,
                size: infoResult.data.size,
                checked: selectAll,
              }
            }
            return null
          })
        )

        const validKeys = keyInfos.filter((k): k is KeyOption => k !== null)

        // Deduplicate keys by name to avoid duplicates in both keys and visibleKeys arrays
        // Use functional update to ensure we're working with the latest state
        setKeys(prevKeys => {
          const existingNames = new Set(prevKeys.map(k => k.name))
          const newKeys = validKeys.filter(k => !existingNames.has(k.name))
          return [...prevKeys, ...newKeys]
        })

        setVisibleKeys(prev => {
          const existingNames = new Set(prev.map(k => k.name))
          const newVisibleKeys = validKeys.filter(k => !existingNames.has(k.name))
          return [...prev, ...newVisibleKeys]
        })

        setKeysFoundCount(prev => prev + validKeys.length)

        // Check if scan is complete
        const isComplete = result.cursor === '0'
        setHasMoreKeys(!isComplete)
        setAllScanned(isComplete)

      } else {
      }
    } catch (error) {
      if (reset) setKeys([])
    } finally {
      if (reset) setLoading(false)
      loadingMoreRef.current = false
    }
  }, [connectionId, searchPattern, selectAll])

  useEffect(() => {
    if (connectionId && isConnected) {
      loadKeys(true)
    } else {
      setKeys([])
    }
  }, [connectionId, isConnected, loadKeys])

  // Debounce pattern search - reset and reload when pattern changes
  useEffect(() => {
    const timer = setTimeout(() => loadKeys(true), 300)
    return () => clearTimeout(timer)
  }, [searchPattern, loadKeys])

  // Load more data manually
  const handleLoadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMoreKeys || allScanned) {
      return
    }
    loadKeys(false)
  }, [hasMoreKeys, allScanned])

  const toggleKey = (keyName: string) => {
    setKeys(keys.map(key =>
      key.name === keyName ? { ...key, checked: !key.checked } : key
    ))
    setVisibleKeys(prev => prev.map(key =>
      key.name === keyName ? { ...key, checked: !key.checked } : key
    ))
  }

  const handleSelectAll = () => {
    const newState = !selectAll
    setSelectAll(newState)
    // Update both keys and visibleKeys
    setKeys(keys.map(key => ({ ...key, checked: newState })))
    setVisibleKeys(prev => prev.map(key => ({ ...key, checked: newState })))
  }

  const getSelectedCount = () => keys.filter(k => k.checked).length

  // Toast notification helper
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 3000)
  }

  const handleBatchDelete = async () => {
    const selectedKeys = keys.filter(k => k.checked)
    if (selectedKeys.length === 0) return

    setProcessing(true)
    setProgress({ current: 0, total: selectedKeys.length })
    setResults({ success: 0, failed: 0, errors: [] })

    for (let i = 0; i < selectedKeys.length; i++) {
      const key = selectedKeys[i]

      try {
        if (window.electronAPI?.redisDelete) {
          const result = await window.electronAPI.redisDelete(connectionId!, key.name)
          if (result.success) {
            setResults(prev => ({ ...prev, success: prev.success + 1 }))
          } else {
            setResults(prev => ({
              ...prev,
              failed: prev.failed + 1,
              errors: [...prev.errors, `${key.name}: ${result.error}`]
            }))
          }
        }
      } catch (error) {
        setResults(prev => ({
          ...prev,
          failed: prev.failed + 1,
          errors: [...prev.errors, `${key.name}: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }))
      }

      setProgress({ current: i + 1, total: selectedKeys.length })
    }

    setProcessing(false)
    await loadKeys(true)

    // Show toast notification
    const finalResults: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }
    // Re-count results from state
    setResults(prev => {
      finalResults.success = prev.success + 1
      finalResults.failed = prev.failed
      finalResults.errors = prev.errors
      return prev
    })

    // Get actual results from the loop
    let actualSuccess = 0
    let actualFailed = 0
    for (let i = 0; i < selectedKeys.length; i++) {
      try {
        const result = await window.electronAPI?.redisDelete?.(connectionId!, selectedKeys[i].name)
        if (result?.success) actualSuccess++
        else actualFailed++
      } catch {
        actualFailed++
      }
    }

    if (actualFailed === 0) {
      showToast(t('redis.successfullyDeleted', { count: actualSuccess }), 'success')
    } else {
      showToast(t('redis.deletedFailed', { success: actualSuccess, failed: actualFailed }), 'error')
    }
  }

  const handleBatchTTL = async () => {
    const selectedKeys = keys.filter(k => k.checked)
    const ttlNum = parseInt(ttlValue)

    if (selectedKeys.length === 0 || (isNaN(ttlNum) && ttlValue !== '')) return

    setProcessing(true)
    setProgress({ current: 0, total: selectedKeys.length })
    setResults({ success: 0, failed: 0, errors: [] })

    for (let i = 0; i < selectedKeys.length; i++) {
      const key = selectedKeys[i]

      try {
        if (window.electronAPI?.redisSetTTL) {
          const result = await window.electronAPI.redisSetTTL(connectionId!, key.name, ttlNum)
          if (result.success) {
            setResults(prev => ({ ...prev, success: prev.success + 1 }))
          } else {
            setResults(prev => ({
              ...prev,
              failed: prev.failed + 1,
              errors: [...prev.errors, `${key.name}: ${result.error}`]
            }))
          }
        }
      } catch (error) {
        setResults(prev => ({
          ...prev,
          failed: prev.failed + 1,
          errors: [...prev.errors, `${key.name}: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }))
      }

      setProgress({ current: i + 1, total: selectedKeys.length })
    }

    setProcessing(false)
    await loadKeys(true)

    // Get actual results from the loop
    let actualSuccess = 0
    let actualFailed = 0
    for (let i = 0; i < selectedKeys.length; i++) {
      try {
        const result = await window.electronAPI?.redisSetTTL?.(connectionId!, selectedKeys[i].name, ttlNum)
        if (result?.success) actualSuccess++
        else actualFailed++
      } catch {
        actualFailed++
      }
    }

    if (actualFailed === 0) {
      showToast(t('redis.successfullySetTTL', { count: actualSuccess }), 'success')
    } else {
      showToast(t('redis.setTTLFailed', { success: actualSuccess, failed: actualFailed }), 'error')
    }
  }

  if (!connectionId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800">
        <p className="text-gray-400 dark:text-gray-500 text-[13px]">{t('redis.pleaseConnectBatch')}</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Pattern Input */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{t('redis.pattern')}:</label>
          <div className="w-48 flex items-center bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
            <input
              type="text"
              value={searchPattern}
              onChange={(e) => setSearchPattern(e.target.value)}
              placeholder={t('redis.patternPlaceholder')}
              className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-transparent text-gray-900 dark:text-white focus:outline-none"
            />
            <button
              onClick={() => loadKeys(true)}
              disabled={loading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
              title={t('toolbar.refreshKeys')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Select All */}
      <div className="flex-shrink-0 h-10 px-2 border-b border-black/10 dark:border-white/10 flex items-center justify-between opacity-80">
        <button
          onClick={handleSelectAll}
          className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {selectAll ? (
            <CheckSquare className="w-3.5 h-3.5 text-green-500 shrink-0" />
          ) : (
            <Square className="w-3.5 h-3.5 shrink-0" />
          )}
          {selectAll ? t('redis.deselectAll') : t('redis.selectAll')}
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {getSelectedCount()} {t('redis.selected')}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">/</span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {keysFoundCount} {t('redis.keys')}
            {!allScanned && <span className="ml-1 text-[11px] text-gray-500 dark:text-gray-400">(more...)</span>}
          </span>

          {/* Execute Buttons */}
          <div className="flex items-center gap-1.5 ml-1.5">
            <button
              onClick={handleBatchDelete}
              disabled={getSelectedCount() === 0 || processing}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors bg-red-500 hover:bg-red-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {processing && operationMode === 'delete' ? (
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <Trash2 className="w-3 h-3 shrink-0" />
              )}
            </button>
            <button
              onClick={handleBatchTTL}
              disabled={getSelectedCount() === 0 || (ttlValue === '' || isNaN(parseInt(ttlValue))) || processing}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors bg-blue-500 hover:bg-blue-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {processing && operationMode === 'ttl' ? (
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <Clock className="w-3 h-3 shrink-0" />
              )}
            </button>
            <input
              type="number"
              value={ttlValue}
              onChange={(e) => setTtlValue(e.target.value)}
              placeholder={t('redis.ttlSeconds')}
              className="w-16 px-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-red-500 shrink-0"
              disabled={processing}
            />
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 px-2 py-1.5 rounded-md shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 z-50 ${
          toast.type === 'success'
            ? 'bg-green-500 text-white'
            : 'bg-red-500 text-white'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="text-[11px] font-medium">{toast.message}</span>
        </div>
      )}

      {/* Key List */}
      <div className="px-2 overflow-hidden flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400 text-[13px] min-h-[200px]">
            <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
            {t('common.loading')}
          </div>
        ) : visibleKeys.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-500 dark:text-gray-400 text-[13px] min-h-[200px]">
            {t('redis.noKeysFound')}
          </div>
        ) : (
          <div className="flex flex-col border border-transparent rounded-md overflow-hidden" style={{ height: 'calc(100vh - 201.5px)' }}>
            {/* Fixed Header */}
            <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-b border-black/10 dark:border-white/10">
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400"></th>
                    <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">{t('redis.keyName')}</th>
                    <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">{t('common.type')}</th>
                    <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">{t('redis.ttl')}</th>
                    <th className="text-left py-1.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400">{t('redis.ttl')}</th>
                  </tr>
                </thead>
              </table>
            </div>

            {/* Scrollable Body - auto fill remaining space */}
            <div ref={tableContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" onScroll={(e) => {
              const target = e.target as HTMLDivElement
              const { scrollTop, scrollHeight, clientHeight } = target
              const distanceToBottom = scrollHeight - scrollTop - clientHeight

              if (!hasMoreKeys || loadingMoreRef.current || allScanned) {
                return
              }

              if (distanceToBottom < 200) {
                loadKeys(false)
              }
            }}>
              <table className="w-full" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col />
                  <col style={{ width: '80px' }} />
                  <col style={{ width: '60px' }} />
                  <col style={{ width: '60px' }} />
                </colgroup>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {Array.from(new Map(visibleKeys.map(k => [k.name, k])).values()).map((key) => (
                    <tr
                      key={key.name}
                      onClick={() => !processing && toggleKey(key.name)}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                        key.checked ? 'bg-red-50 dark:bg-red-900/20' : ''
                      }`}
                    >
                      <td className="py-1.5 px-2">
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={key.checked}
                            readOnly
                            className="w-3.5 h-3.5 accent-red-500 cursor-pointer shrink-0"
                          />
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="text-[11px] font-medium text-gray-900 dark:text-white truncate" title={key.name}>
                          {key.name}
                        </div>
                      </td>
                      <td className="py-1.5 px-2">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium inline-block ${
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
                      <td className="py-1.5 px-2">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{key.size}</span>
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{key.ttl < 0 ? '-1' : key.ttl}s</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More Button */}
            <div className="flex-shrink-0 px-2 py-0 bg-gray-50 dark:bg-gray-900/10 border-t border-black/10 dark:border-white/10 h-8 flex items-center">
              <button
                onClick={handleLoadMore}
                disabled={!hasMoreKeys || loadingMoreRef.current || allScanned}
                className="w-full h-6 text-[11px] text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-transparent dark:hover:bg-transparent disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {loadingMoreRef.current ? t('redis.loadingMore') : allScanned ? t('redis.allLoaded') : `${t('redis.loadMore')} (${visibleKeys.length}/${keys.length})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex-shrink-0 h-[52px] px-2 border-t border-black/10 dark:border-white/10 bg-gray-50 dark:bg-gray-800 flex items-center justify-between">
        {processing && (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{t('redis.processing')} {progress.current} / {progress.total}</span>
          </div>
        )}
        {!processing && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span>{keysFoundCount} {t('redis.keys')}</span>
            {allScanned && <span className="flex items-center gap-1">✓ {t('redis.keysScanned')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}