import { useState, useEffect, useRef } from 'react'
import {
  FileCode,
  X,
  RefreshCw,
  Loader2,
  AlertCircle,
  Database,
  User,
  Copy,
  Check,
  Edit2,
} from 'lucide-react'
import { useTranslation } from '@/store/i18nStore'

// 格式化值
function formatValue(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (Buffer.isBuffer && Buffer.isBuffer(value)) return value.toString('utf-8')
  if (typeof value === 'object' && value.type === 'Buffer') {
    return Buffer.from(value.data).toString('utf-8')
  }
  return String(value)
}

interface ProcedureDetailProps {
  connectionId: string
  database: string
  procedure: string
  onClose?: () => void
}

interface ProcedureInfo {
  name: string
  definer: string
  securityType: string
  body: string
  parameters: { name: string; type: string; mode: string }[]
}

export default function ProcedureDetail({ connectionId, database, procedure, onClose }: ProcedureDetailProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<ProcedureInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)

  // SQL确认弹窗状态
  const [showSqlConfirm, setShowSqlConfirm] = useState(false)
  const [pendingSql, setPendingSql] = useState('')
  const originalBodyRef = useRef<string>('')  // 保存原始body用于恢复

  const loadProcedureInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      if (window.electronAPI?.dbExecuteQuery) {
        // 获取存储过程创建语句
        const result = await window.electronAPI.dbExecuteQuery(
          connectionId,
          `SHOW CREATE PROCEDURE \`${database}\`.\`${procedure}\``,
          database
        )

        if (result.success && result.data && result.data.length > 0) {
          const row = result.data[0]
          // MySQL返回的列名可能是 Create Procedure
          const body = formatValue(row['Create Procedure'] || row[2])

          // 获取详细信息
          const infoResult = await window.electronAPI.dbExecuteQuery(
            connectionId,
            `SELECT
              ROUTINE_NAME as name,
              DEFINER as definer,
              SECURITY_TYPE as securityType
            FROM INFORMATION_SCHEMA.ROUTINES
            WHERE ROUTINE_SCHEMA = '${database}' AND ROUTINE_NAME = '${procedure}'`,
            database
          )

          let procedureInfo: ProcedureInfo = {
            name: procedure,
            definer: '',
            securityType: '',
            body: body,
            parameters: []
          }

          if (infoResult.success && infoResult.data && infoResult.data.length > 0) {
            const infoRow = infoResult.data[0]
            procedureInfo = {
              ...procedureInfo,
              definer: formatValue(infoRow['definer'] || infoRow[1]),
              securityType: formatValue(infoRow['securityType'] || infoRow[2]),
            }
          }

          // 获取参数
          const paramResult = await window.electronAPI.dbExecuteQuery(
            connectionId,
            `SELECT
              PARAMETER_NAME as name,
              DATA_TYPE as type,
              PARAMETER_MODE as mode
            FROM INFORMATION_SCHEMA.PARAMETERS
            WHERE SPECIFIC_SCHEMA = '${database}' AND SPECIFIC_NAME = '${procedure}'
            ORDER BY ORDINAL_POSITION`,
            database
          )

          if (paramResult.success && paramResult.data) {
            procedureInfo.parameters = paramResult.data
              .filter((p: any) => p['name'] || p[0]) // 过滤掉返回值参数
              .map((p: any) => ({
                name: p['name'] || p[0] || '',
                type: p['type'] || p[1] || '',
                mode: p['mode'] || p[2] || 'IN'
              }))
          }

          setInfo(procedureInfo)
          setEditBody(procedureInfo.body)
          originalBodyRef.current = procedureInfo.body  // 保存原始body用于恢复
        } else {
          setError(result.error || 'Failed to load procedure info')
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProcedureInfo()
  }, [connectionId, database, procedure])

  const copyToClipboard = async () => {
    if (info?.body) {
      await navigator.clipboard.writeText(info.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const startEdit = () => {
    setEditBody(info?.body || '')
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditBody(info?.body || '')
    setShowSqlConfirm(false)
  }

  // 显示SQL确认弹窗
  const showSaveConfirm = () => {
    if (!editBody.trim()) return
    // 构建完整的执行SQL
    const dropSql = `DROP PROCEDURE IF EXISTS \`${database}\`.\`${procedure}\`;`
    const fullSql = `${dropSql}\n\n${editBody}`
    setPendingSql(fullSql)
    setShowSqlConfirm(true)
  }

  // 确认执行SQL
  const confirmExecute = async () => {
    if (!editBody.trim()) return
    setSaving(true)
    setShowSqlConfirm(false)
    try {
      if (window.electronAPI?.dbExecuteQuery) {
        // 先删除旧的存储过程
        const dropResult = await window.electronAPI.dbExecuteQuery(
          connectionId,
          `DROP PROCEDURE IF EXISTS \`${database}\`.\`${procedure}\``,
          database
        )

        if (!dropResult.success) {
          throw new Error(dropResult.error || 'DROP PROCEDURE failed')
        }

        // 创建新的
        const createResult = await window.electronAPI.dbExecuteQuery(
          connectionId,
          editBody,
          database
        )

        if (!createResult.success) {
          // CREATE失败，尝试恢复原始存储过程
          if (originalBodyRef.current && originalBodyRef.current.trim()) {
            try {
              await window.electronAPI.dbExecuteQuery(
                connectionId,
                originalBodyRef.current,
                database
              )
              alert(`${t('common.error')}: ${createResult.error}\n\n${t('database.procedureRestoreSuccess')}`)
            } catch (restoreError) {
              alert(`${t('common.error')}: ${createResult.error}\n\n${t('database.procedureRestoreFailed')}: ${restoreError instanceof Error ? restoreError.message : 'Unknown error'}`)
            }
          } else {
            alert(`${t('common.error')}: ${createResult.error}`)
          }
          return
        }

        setIsEditing(false)
        loadProcedureInfo()
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  // 取消SQL确认弹窗
  const cancelSqlConfirm = () => {
    setShowSqlConfirm(false)
    setPendingSql('')
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-800">
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-900 dark:text-white">{procedure}</span>
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
            <FileCode className="w-4 h-4 text-green-500" />
            <span className="font-medium text-gray-900 dark:text-white">{procedure}</span>
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
            onClick={loadProcedureInfo}
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
          <FileCode className="w-4 h-4 text-green-500" />
          <span className="font-medium text-gray-900 dark:text-white">{procedure}</span>
          <span className="text-xs text-gray-400">{database}</span>
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={showSaveConfirm}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {t('common.save')}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded disabled:opacity-50"
              >
                <X className="w-3 h-3" />
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title={t('common.edit')}
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={copyToClipboard}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title={t('database.copyCreateStatement')}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </>
          )}
          <button
            onClick={loadProcedureInfo}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50"
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
          <div className="flex items-center gap-4">
            {info.definer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">{t('database.definer')}:</span>
                <span className="text-gray-700 dark:text-gray-300 font-mono">{info.definer}</span>
              </div>
            )}
            {info.securityType && (
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500 dark:text-gray-400">{t('database.securityType')}:</span>
                <span className="text-gray-700 dark:text-gray-300">{info.securityType}</span>
              </div>
            )}
          </div>

          {/* Parameters */}
          {info.parameters.length > 0 && (
            <div className="mt-3">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{t('database.parameters')}</div>
              <div className="flex flex-wrap gap-2">
                {info.parameters.map((param, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm">
                    <span className={`font-medium ${
                      param.mode === 'IN' ? 'text-blue-500' :
                      param.mode === 'OUT' ? 'text-green-500' :
                      param.mode === 'INOUT' ? 'text-purple-500' : 'text-gray-500'
                    }`}>
                      {param.mode}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono">{param.name}</span>
                    <span className="text-gray-400 dark:text-gray-500">{param.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('database.createStatement')}</div>
        {isEditing ? (
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            className="w-full h-[calc(100%-2rem)] bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs text-gray-700 dark:text-gray-300 font-mono border border-blue-300 dark:border-blue-600 focus:outline-none focus:border-blue-500 resize-none"
            spellCheck={false}
          />
        ) : (
          <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre font-mono border border-gray-200 dark:border-gray-700">
            {info?.body || ''}
          </pre>
        )}
      </div>

      {/* SQL确认弹窗 */}
      {showSqlConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('database.confirmSaveChanges')}</h3>
              <button onClick={cancelSqlConfirm} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('database.confirmSaveChangesHint')}</p>
              <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap overflow-x-auto">
                {pendingSql}
              </pre>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <button onClick={cancelSqlConfirm} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={confirmExecute} disabled={saving} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 transition-colors">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}