import React, { useState, useEffect, useMemo } from 'react'
import {
  X,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Play,
  Database,
  FileText,
  Table,
  AlertCircle,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  Search,
} from 'lucide-react'
import { useAiStore, AIFeatureType, AIRequestParams, TableSchemaInfo, DatabaseTableInfo } from '@/store/aiStore'
import { useTranslation } from '@/store/i18nStore'
import { callAI, detectDangerousSQL, isWriteOperation } from '@/services/aiService'

// 功能类型配置
const FEATURE_CONFIGS: Record<AIFeatureType, {
  icon: React.ReactNode
  titleKey: string
  placeholderKey: string
  descriptionKey: string
}> = {
  'sql-generate': {
    icon: <Sparkles className="w-4 h-4 text-purple-500" />,
    titleKey: 'ai.sqlGenerate',
    placeholderKey: 'ai.sqlGeneratePlaceholder',
    descriptionKey: 'ai.sqlGenerateDesc',
  },
  'sql-explain': {
    icon: <FileText className="w-4 h-4 text-blue-500" />,
    titleKey: 'ai.sqlExplain',
    placeholderKey: 'ai.sqlExplainPlaceholder',
    descriptionKey: 'ai.sqlExplainDesc',
  },
  'data-generate': {
    icon: <Table className="w-4 h-4 text-green-500" />,
    titleKey: 'ai.dataGenerate',
    placeholderKey: 'ai.dataGeneratePlaceholder',
    descriptionKey: 'ai.dataGenerateDesc',
  },
}

// 安全确认弹窗组件
function SafetyConfirmDialog({
  isOpen,
  sql,
  dangerInfo,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  sql: string
  dangerInfo: { isDangerous: boolean; reason: string; level: 'high' | 'medium' | 'low' }
  onConfirm: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()

  if (!isOpen) return null

  const isHighRisk = dangerInfo.level === 'high'
  const isMediumRisk = dangerInfo.level === 'medium'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-4">
        <div className="flex items-center gap-2 mb-3">
          {isHighRisk ? (
            <ShieldAlert className="w-5 h-5 text-red-500" />
          ) : isMediumRisk ? (
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          ) : (
            <Info className="w-5 h-5 text-blue-500" />
          )}
          <h3 className="text-[14px] font-semibold text-gray-900 dark:text-white">
            {isHighRisk ? t('ai.highRiskTitle') : isMediumRisk ? t('ai.mediumRiskTitle') : t('ai.confirmExecute')}
          </h3>
        </div>

        {/* 风险提示 */}
        {dangerInfo.reason && (
          <div className={`mb-3 p-2 rounded-md text-[12px] ${
            isHighRisk
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              : isMediumRisk
              ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800'
              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
          }`}>
            <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
            {dangerInfo.reason}
          </div>
        )}

        {/* SQL预览 */}
        <div className="mb-4">
          <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('ai.sqlPreview')}
          </label>
          <pre className="bg-gray-100 dark:bg-gray-900 p-2 rounded-md text-[12px] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap">
            {sql}
          </pre>
        </div>

        {/* 高危操作禁止执行 */}
        {isHighRisk ? (
          <div className="text-center py-2 text-red-600 dark:text-red-400 text-[13px]">
            {t('ai.highRiskBlocked')}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-[13px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onConfirm}
              className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                isMediumRisk
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {t('ai.confirmAndExecute')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AiFeaturePanel({
  isOpen,
  featureType,
  onClose,
  onApply,
  context,
  initialInput,
  safeMode = false,
}: {
  isOpen: boolean
  featureType: AIFeatureType
  onClose: () => void
  onApply?: (result: string) => void
  context?: AIRequestParams['context']
  initialInput?: string
  safeMode?: boolean  // 安全模式：拦截所有写操作
}) {
  const { t } = useTranslation()
  const {
    getFeatureState,
    setFeatureInput,
    setFeatureOutput,
    setFeatureLoading,
    getActiveConfig,
    hasValidConfig,
    setShowConfigPanel,
  } = useAiStore()

  // 获取当前功能类型的状态
  const featureState = getFeatureState(featureType)
  const { input: featureInput, output: featureOutput, loading: featureLoading } = featureState

  const [copied, setCopied] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showTableSelector, setShowTableSelector] = useState(false)
  const [tableSearchFilter, setTableSearchFilter] = useState('')
  const [selectedTableHint, setSelectedTableHint] = useState<string | null>(null)
  const featureConfig = FEATURE_CONFIGS[featureType]

  // 解析AI输出中的表选择注释
  const tableMatchInfo = useMemo(() => {
    if (!featureOutput || featureOutput.startsWith('❌') || featureType !== 'sql-generate') {
      return null
    }
    // 匹配注释格式：-- 根据描述匹配到表：表名(原因)
    const match = featureOutput.match(/--\s*根据描述匹配到表[:：]\s*(\w+)\s*[（\(]([^）\)]+)[）\)]/)
    if (match) {
      return {
        tableName: match[1],
        reason: match[2]
      }
    }
    // 尝试从SQL中提取表名
    const sqlMatch = featureOutput.match(/(?:FROM|JOIN|INTO|UPDATE)\s+[`']?(\w+)[`']?/i)
    if (sqlMatch) {
      return {
        tableName: sqlMatch[1],
        reason: '从SQL语句推断'
      }
    }
    return null
  }, [featureOutput, featureType])

  // 分析输出SQL的危险等级
  const dangerInfo = useMemo(() => {
    if (!featureOutput || featureOutput.startsWith('❌') || featureType !== 'sql-generate') {
      return { isDangerous: false, reason: '', level: 'low' as 'high' | 'medium' | 'low' }
    }
    return detectDangerousSQL(featureOutput)
  }, [featureOutput, featureType])

  // 检测是否为写操作
  const isWriteOp = useMemo(() => {
    if (!featureOutput || featureOutput.startsWith('❌')) return false
    return isWriteOperation(featureOutput)
  }, [featureOutput])

  // 初始化输入
  useEffect(() => {
    if (isOpen && initialInput && !featureInput) {
      setFeatureInput(featureType, initialInput)
    }
  }, [isOpen, initialInput, featureType, featureInput, setFeatureInput])

  // 执行AI请求
  const handleExecute = async () => {
    const config = getActiveConfig()
    if (!config || !hasValidConfig()) {
      setFeatureOutput(featureType, t('ai.noValidConfig'))
      return
    }

    if (!featureInput.trim()) {
      setFeatureOutput(featureType, t('ai.emptyInput'))
      return
    }

    setFeatureLoading(featureType, true)
    setFeatureOutput(featureType, '')

    try {
      // 如果用户手动指定了表，将其添加到prompt中
      let effectivePrompt = featureInput
      if (selectedTableHint && featureType === 'sql-generate') {
        effectivePrompt = `[指定表：${selectedTableHint}] ${featureInput}`
      }

      const params: AIRequestParams = {
        featureType,
        prompt: effectivePrompt,
        context,
      }

      const result = await callAI(config, params)

      if (result.success) {
        setFeatureOutput(featureType, result.content || '')
      } else {
        setFeatureOutput(featureType, `❌ ${result.error}`)
      }
    } catch (error) {
      setFeatureOutput(featureType, `❌ ${error instanceof Error ? error.message : t('common.error')}`)
    } finally {
      setFeatureLoading(featureType, false)
    }
  }

  // 选择表作为查询目标
  const handleSelectTable = (tableName: string) => {
    setSelectedTableHint(tableName)
    setShowTableSelector(false)
    setTableSearchFilter('')
  }

  // 复制结果
  const handleCopy = () => {
    navigator.clipboard.writeText(featureOutput)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 应用结果（插入到SQL编辑器）
  const handleApplyClick = () => {
    if (!featureOutput || featureOutput.startsWith('❌')) return

    // 写操作或危险SQL需要确认
    if (isWriteOp || dangerInfo.isDangerous) {
      setShowConfirmDialog(true)
    } else {
      // 安全的SELECT直接应用
      handleApply()
    }
  }

  // 确认后执行
  const handleConfirmExecute = () => {
    setShowConfirmDialog(false)
    handleApply()
  }

  // 实际应用SQL
  const handleApply = () => {
    if (onApply) {
      onApply(featureOutput)
      onClose()
    }
  }

  if (!isOpen) return null

  const hasValid = hasValidConfig()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-md shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {featureConfig.icon}
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              {t(featureConfig.titleKey)}
            </h3>
            {/* 安全模式标识 */}
            {safeMode && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] rounded">
                <ShieldCheck className="w-3 h-3" />
                {t('ai.safeMode')}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 说明 */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t(featureConfig.descriptionKey)}
          </p>
        </div>

        {/* 没有有效配置提示 */}
        {!hasValid && (
          <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
              <span className="text-[13px] text-yellow-600 dark:text-yellow-400">
                {t('ai.noValidConfigWarning')}
              </span>
              <button
                onClick={() => { setShowConfigPanel(true); onClose() }}
                className="ml-auto px-2 py-1 text-[11px] bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors"
              >
                <Settings className="w-3 h-3 inline mr-1" />
                {t('ai.configure')}
              </button>
            </div>
          </div>
        )}

        {/* 没有选中表的提示（仅对sql-generate显示） */}
        {hasValid && featureType === 'sql-generate' && !context?.tableSchema && context?.databaseTables && (
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-500" />
              <span className="text-[13px] text-blue-600 dark:text-blue-400">
                {t('ai.noTableSelected')}
              </span>
              <button
                onClick={() => setShowTableSelector(!showTableSelector)}
                className="ml-auto flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                <Table className="w-3 h-3" />
                {t('ai.selectTable')}
                <ChevronDown className={`w-3 h-3 transition-transform ${showTableSelector ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* 手动指定的表显示 */}
            {selectedTableHint && (
              <div className="flex items-center gap-2 text-[12px] text-gray-600 dark:text-gray-400">
                <Check className="w-3.5 h-3.5 text-green-500" />
                <span>{t('ai.specifiedTable')}: </span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">{selectedTableHint}</span>
                <button
                  onClick={() => setSelectedTableHint(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 表选择器下拉 */}
            {showTableSelector && (
              <div className="mt-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 max-h-[200px] overflow-hidden">
                {/* 搜索框 */}
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md">
                    <Search className="w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      value={tableSearchFilter}
                      onChange={(e) => setTableSearchFilter(e.target.value)}
                      placeholder={t('ai.searchTable')}
                      className="flex-1 bg-transparent text-[12px] text-gray-700 dark:text-gray-300 outline-none"
                    />
                  </div>
                </div>

                {/* 表列表 */}
                <div className="overflow-auto max-h-[150px]">
                  {context.databaseTables
                    .filter(t => !tableSearchFilter || t.name.toLowerCase().includes(tableSearchFilter.toLowerCase()) || (t.comment && t.comment.toLowerCase().includes(tableSearchFilter.toLowerCase())))
                    .slice(0, 30)
                    .map((table) => (
                      <button
                        key={table.name}
                        onClick={() => handleSelectTable(table.name)}
                        className={`w-full px-3 py-2 flex items-center gap-2 text-[12px] hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${
                          selectedTableHint === table.name ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      >
                        <Table className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-mono text-gray-900 dark:text-white">{table.name}</span>
                        {table.comment && (
                          <span className="text-gray-500 dark:text-gray-400 text-[11px]">({table.comment})</span>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 输入区域 */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {t('ai.input')}
          </label>
          <textarea
            value={featureInput}
            onChange={(e) => setFeatureInput(featureType, e.target.value)}
            placeholder={t(featureConfig.placeholderKey)}
            rows={featureType === 'sql-explain' ? 6 : 4}
            className="w-full px-3 py-2 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
            disabled={featureLoading}
          />

          {/* 执行按钮 */}
          <div className="flex items-center justify-end mt-2">
            <button
              onClick={handleExecute}
              disabled={featureLoading || !hasValid || !featureInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-[13px] font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {featureLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {featureLoading ? t('ai.processing') : t('ai.execute')}
            </button>
          </div>
        </div>

        {/* 输出区域 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* AI表匹配信息显示 */}
          {tableMatchInfo && featureType === 'sql-generate' && (
            <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-200 dark:border-purple-800 flex items-center gap-2">
              <Table className="w-4 h-4 text-purple-500" />
              <span className="text-[12px] text-purple-600 dark:text-purple-400">
                {t('ai.aiMatchedTable')}:
              </span>
              <span className="font-mono font-medium text-purple-700 dark:text-purple-300">{tableMatchInfo.tableName}</span>
              <span className="text-[11px] text-purple-500 dark:text-purple-400">({tableMatchInfo.reason})</span>
              {/* 如果匹配的表与手动指定的表不同，显示警告 */}
              {selectedTableHint && selectedTableHint !== tableMatchInfo.tableName && (
                <span className="text-[11px] text-orange-500 dark:text-orange-400 ml-2">
                  ({t('ai.tableMismatch')}: {t('ai.youSpecified')} {selectedTableHint})
                </span>
              )}
            </div>
          )}

          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {t('ai.output')}
            </span>

            {/* 危险等级标识 */}
            {featureOutput && !featureOutput.startsWith('❌') && featureType === 'sql-generate' && (
              <div className={`flex items-center gap-1 text-[11px] ${
                dangerInfo.level === 'high'
                  ? 'text-red-600 dark:text-red-400'
                  : dangerInfo.level === 'medium'
                  ? 'text-orange-600 dark:text-orange-400'
                  : isWriteOp
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {dangerInfo.level === 'high' ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : dangerInfo.level === 'medium' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : isWriteOp ? (
                  <Shield className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                {dangerInfo.level === 'high' ? t('ai.highRisk') : dangerInfo.level === 'medium' ? t('ai.mediumRisk') : isWriteOp ? t('ai.writeOp') : t('ai.safeQuery')}
              </div>
            )}

            {featureOutput && !featureOutput.startsWith('❌') && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
                {onApply && (
                  <button
                    onClick={handleApplyClick}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    {t('ai.apply')}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-4">
            {featureOutput ? (
              <pre className="text-[13px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                {featureOutput}
              </pre>
            ) : (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[13px]">{t('ai.waitingInput')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 安全确认弹窗 */}
      <SafetyConfirmDialog
        isOpen={showConfirmDialog}
        sql={featureOutput}
        dangerInfo={dangerInfo}
        onConfirm={handleConfirmExecute}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </div>
  )
}