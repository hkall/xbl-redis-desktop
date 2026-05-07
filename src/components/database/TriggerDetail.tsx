import { useState, useEffect } from 'react'
import {
  Bolt,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Table,
} from 'lucide-react'
import { useTranslation } from '@/store/i18nStore'

interface TriggerDetailProps {
  connectionId: string
  database: string
  trigger: string
  onClose?: () => void
}

interface TriggerInfo {
  name: string
  event: string
  timing: string
  table: string
  definer: string
  body: string
}

export default function TriggerDetail({ connectionId, database, trigger, onClose }: TriggerDetailProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<TriggerInfo | null>(null)
  const [copied, setCopied] = useState(false)

  const loadTriggerInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI?.dbExecuteQuery) {
        // 获取触发器创建语句
        const result = await window.electronAPI.dbExecuteQuery(
          connectionId,
          `SHOW CREATE TRIGGER \`${database}\`.\`${trigger}\``,
          database
        )

        if (result.success && result.data && result.data.length > 0) {
          const row = result.data[0]
          // MySQL返回的列名可能是 SQL Original Statement
          const body = row['SQL Original Statement'] || row[2] || row['SQL Original Statement'] || ''

          // 获取详细信息
          const infoResult = await window.electronAPI.dbExecuteQuery(
            connectionId,
            `SELECT
              TRIGGER_NAME as name,
              EVENT_MANIPULATION as event,
              ACTION_TIMING as timing,
              EVENT_OBJECT_TABLE as \`table\`,
              DEFINER as definer
            FROM INFORMATION_SCHEMA.TRIGGERS
            WHERE TRIGGER_SCHEMA = '${database}' AND TRIGGER_NAME = '${trigger}'`,
            database
          )

          let triggerInfo: TriggerInfo = {
            name: trigger,
            event: '',
            timing: '',
            table: '',
            definer: '',
            body: body
          }

          if (infoResult.success && infoResult.data && infoResult.data.length > 0) {
            const infoRow = infoResult.data[0]
            triggerInfo = {
              ...triggerInfo,
              event: infoRow['event'] || infoRow[1] || '',
              timing: infoRow['timing'] || infoRow[2] || '',
              table: infoRow['table'] || infoRow[3] || '',
              definer: infoRow['definer'] || infoRow[4] || '',
            }
          }

          setInfo(triggerInfo)
        } else {
          setError(result.error || 'Failed to load trigger info')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTriggerInfo()
  }, [connectionId, database, trigger])

  const copyToClipboard = async () => {
    if (info?.body) {
      await navigator.clipboard.writeText(info.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-800">
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bolt className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-gray-900 dark:text-white">{trigger}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-800">
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bolt className="w-4 h-4 text-orange-500" />
            <span className="font-medium text-gray-900 dark:text-white">{trigger}</span>
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
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
          <p className="text-red-500 text-sm text-center">{error}</p>
          <button
            onClick={loadTriggerInfo}
            className="mt-2 px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {t('common.refresh')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bolt className="w-4 h-4 text-orange-500" />
          <span className="font-medium text-gray-900 dark:text-white">{trigger}</span>
          <span className="text-xs text-gray-400">{database}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={copyToClipboard}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title={t('database.copyCreateStatement')}
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={loadTriggerInfo}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title={t('common.refresh')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      {info && (
        <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-3">
            {info.timing && info.event && (
              <div className="flex items-center gap-2 text-sm">
                <Bolt className="w-4 h-4 text-orange-400" />
                <span className="text-gray-500 dark:text-gray-400">{t('database.triggerTiming')}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  info.timing === 'BEFORE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {info.timing}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  info.event === 'INSERT' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  info.event === 'UPDATE' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                }`}>
                  {info.event}
                </span>
              </div>
            )}
            {info.table && (
              <div className="flex items-center gap-2 text-sm">
                <Table className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">{t('database.relatedTable')}</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono">{info.table}</span>
              </div>
            )}
            {info.definer && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">{t('database.definer')}:</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono">{info.definer}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('database.createStatement')}</div>
        <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre font-mono border border-gray-200 dark:border-gray-700">
          {info?.body || ''}
        </pre>
      </div>
    </div>
  )
}