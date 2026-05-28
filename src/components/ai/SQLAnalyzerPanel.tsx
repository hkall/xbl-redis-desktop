import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Copy, Check, Database, AlertCircle, RefreshCw } from 'lucide-react'
import { useAiStore, AIRequestParams } from '@/store/aiStore'
import { useTranslation } from '@/store/i18nStore'
import { callAI } from '@/services/aiService'

interface AnalysisResult {
  summary: string
  statementType: string
  tables: string[]
  performanceScore: number
  performanceLevel: string
  issues: Array<{ severity: 'high' | 'medium' | 'low'; description: string; suggestion: string }>
  indexSuggestions: Array<{ table: string; columns: string[]; sql: string }>
  rewrittenSQL?: string
  optimizationTips: string[]
  securityIssues: Array<{ severity: 'high' | 'medium' | 'low'; description: string; solution: string }>
  bestPractices: string[]
}

const parseResult = (content: string): AnalysisResult | null => {
  try {
    // 尝试多种方式提取JSON
    let jsonStr = content

    // 1. 尝试提取markdown代码块中的JSON
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

    // 2. 尝试提取花括号包裹的内容
    if (!jsonStr.startsWith('{')) {
      const braceMatch = content.match(/\{[\s\S]*\}/)
      if (braceMatch) jsonStr = braceMatch[0]
    }

    // 3. 清理可能的非JSON内容
    jsonStr = jsonStr.trim()

    const parsed = JSON.parse(jsonStr)
    return {
      summary: parsed.summary || '',
      statementType: parsed.statementType || 'SELECT',
      tables: parsed.tables || [],
      performanceScore: parsed.performanceScore ?? 50,
      performanceLevel: parsed.performanceLevel || '一般',
      issues: (parsed.issues || []).map((i: any) => ({
        severity: i.severity || 'low',
        description: i.description || '',
        suggestion: i.suggestion || ''
      })),
      indexSuggestions: (parsed.indexSuggestions || []).map((i: any) => ({
        table: i.table || '',
        columns: i.columns || [],
        sql: i.sql || ''
      })),
      rewrittenSQL: parsed.rewrittenSQL,
      optimizationTips: parsed.optimizationTips || [],
      securityIssues: (parsed.securityIssues || []).map((i: any) => ({
        severity: i.severity || 'low',
        description: i.description || '',
        solution: i.solution || ''
      })),
      bestPractices: parsed.bestPractices || [],
    }
  } catch (e) {
    console.error('JSON解析失败:', e)
    return null
  }
}

export default function SQLAnalyzerPanel({ isOpen, onClose, context, initialSQL }: {
  isOpen: boolean; onClose: () => void; context?: AIRequestParams['context']; initialSQL?: string
}) {
  const { t } = useTranslation()
  const { getFeatureState, setFeatureInput, setFeatureOutput, setFeatureLoading, getActiveConfig, hasValidConfig, setShowConfigPanel } = useAiStore()
  const { input, output, loading } = getFeatureState('sql-analyze')
  const [analyzeTime, setAnalyzeTime] = useState<number | null>(null)
  const result = useMemo(() => output && !output.startsWith('❌') ? parseResult(output) : null, [output])

  useEffect(() => { if (isOpen && initialSQL && !input) setFeatureInput('sql-analyze', initialSQL) }, [isOpen, initialSQL, input])

  const analyze = async () => {
    const config = getActiveConfig()
    if (!config || !hasValidConfig()) { setFeatureOutput('sql-analyze', `❌ ${t('ai.noValidConfig')}`); return }
    if (!input.trim()) { setFeatureOutput('sql-analyze', `❌ ${t('ai.emptyInput')}`); return }
    setFeatureLoading('sql-analyze', true)
    setFeatureOutput('sql-analyze', '')
    setAnalyzeTime(null)
    const startTime = Date.now()
    try {
      const res = await callAI(config, { featureType: 'sql-analyze', prompt: input, context: { ...context, existingSql: input } })
      setFeatureOutput('sql-analyze', res.success ? res.content || '' : `❌ ${res.error}`)
      setAnalyzeTime(Date.now() - startTime)
    } catch (e) {
      setFeatureOutput('sql-analyze', `❌ ${e instanceof Error ? e.message : t('common.error')}`)
    } finally { setFeatureLoading('sql-analyze', false) }
  }

  if (!isOpen) return null
  const hasConfig = hasValidConfig()
  const scoreColor = result?.performanceScore >= 80 ? '#22c55e' : result?.performanceScore >= 60 ? '#3b82f6' : result?.performanceScore >= 40 ? '#eab308' : '#ef4444'
  const highIssues = result?.issues.filter(i => i.severity === 'high').length || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] w-full max-w-4xl mx-6 shadow-2xl rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center px-6 h-11 border-b dark:border-[#333]">
          <span className="font-medium dark:text-white">{t('ai.sqlAnalyzer')}</span>
          {analyzeTime && <span className="ml-3 text-xs text-gray-400">{analyzeTime}ms</span>}
          {result && <button onClick={() => { setFeatureInput('sql-analyze', ''); setFeatureOutput('sql-analyze', '') }} className="ml-2 p-1 text-gray-400 hover:text-gray-600"><RefreshCw className="w-3.5 h-3.5"/></button>}
          <button onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4"/></button>
        </div>

        {!hasConfig && (
          <div className="px-6 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4"/>
            <span>{t('ai.noValidConfigWarning')}</span>
            <button onClick={() => { setShowConfigPanel(true); onClose() }} className="ml-auto hover:underline">{t('ai.configure')}</button>
          </div>
        )}

        {/* Input */}
        <div className="px-6 py-4 border-b dark:border-[#333]">
          <textarea value={input} onChange={e => setFeatureInput('sql-analyze', e.target.value)} placeholder={t('ai.sqlInputPlaceholder')}
            className="w-full h-20 p-3 text-sm font-mono bg-gray-50 dark:bg-[#222] border dark:border-[#333] rounded-lg resize-none dark:text-white focus:outline-none"
            disabled={loading}/>
          <div className="flex justify-end mt-3">
            <button onClick={analyze} disabled={loading || !hasConfig || !input.trim()}
              className="px-6 py-1.5 text-sm bg-gray-800 dark:bg-gray-700 text-white rounded-md disabled:opacity-40">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1"/>}
              {loading ? t('ai.analyzing') : t('ai.analyze')}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="px-6 py-4 min-h-[180px] max-h-[450px] overflow-auto">
          {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400"/></div>
          : !output ? <div className="flex justify-center py-8 text-gray-300"><Database className="w-8 h-8"/></div>
          : output.startsWith('❌') ? <div className="flex items-center justify-center py-8 text-red-500"><AlertCircle className="w-4 h-4 mr-2"/>{output.slice(2)}</div>
          : result ? (
            <div className="space-y-4">
              {/* Score Header - 换行布局 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 border-b dark:border-[#333]">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold" style={{color: scoreColor}}>{result.performanceScore}</span>
                  <span className="text-sm text-gray-400">/100</span>
                </div>
                <span className="px-2 py-0.5 rounded text-xs whitespace-nowrap" style={{color: scoreColor, background: scoreColor + '20'}}>{result.performanceLevel}</span>
                <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">{result.statementType} · {result.tables.join(', ') || '未知表'}</span>
              </div>

              {highIssues > 0 && <div className="px-3 py-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-sm">发现 {highIssues} 个高危问题</div>}

              {result.summary && <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{result.summary}</p>}

              {result.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">问题诊断</div>
                  {result.issues.map((issue, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-orange-400' : 'bg-blue-400'}`}/>
                      <div className="flex-1">
                        <div className="dark:text-gray-200">{issue.description}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{issue.suggestion}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.indexSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">索引建议</div>
                  {result.indexSuggestions.map((idx, i) => (
                    <div key={i} className="flex gap-2 items-start text-sm">
                      <button onClick={() => navigator.clipboard.writeText(idx.sql)} className="p-1 text-gray-400 hover:text-gray-600 shrink-0"><Copy className="w-3.5 h-3.5"/></button>
                      <pre className="font-mono text-xs dark:text-gray-300 flex-1 whitespace-pre-wrap break-all">{idx.sql}</pre>
                    </div>
                  ))}
                </div>
              )}

              {result.rewrittenSQL && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">优化SQL</div>
                  <pre className="text-sm font-mono p-3 bg-gray-50 dark:bg-[#222] rounded dark:text-gray-300 whitespace-pre-wrap">{result.rewrittenSQL}</pre>
                </div>
              )}

              {result.securityIssues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-red-500 uppercase tracking-wide">安全风险</div>
                  {result.securityIssues.map((issue, i) => (
                    <div key={i} className="text-sm text-red-600 dark:text-red-400 pl-2">{issue.description} — {issue.solution}</div>
                  ))}
                </div>
              )}

              {(result.optimizationTips.length > 0 || result.bestPractices.length > 0) && (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">优化建议</div>
                  {[...result.optimizationTips, ...result.bestPractices].map((tip, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <Check className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0"/>
                      <span className="dark:text-gray-300 flex-1">{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {!result.issues.length && !result.indexSuggestions.length && !result.rewrittenSQL && !result.securityIssues.length && (
                <div className="text-center py-6 text-green-500"><Check className="w-5 h-5 mx-auto mb-1"/>{t('ai.noOptimizationNeeded')}</div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4"/>
                <span>分析结果解析失败</span>
              </div>
              <pre className="text-xs font-mono p-3 bg-gray-50 dark:bg-[#222] rounded overflow-auto max-h-[200px] dark:text-gray-300">{output}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}