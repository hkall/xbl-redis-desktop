import React, { useState, useRef, useCallback } from 'react'
import { Zap, Play, Square, Plus, Trash2, Clock, ArrowLeft, ChevronDown, ChevronUp, Settings2, HelpCircle } from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { StressTestConfig, StressTestMetrics, StressTestVariable } from '@/types/testTypes'
import { StressTestEngine } from '@/utils/stressEngine'
import { useToast } from '@/components/common/Toast'

// 使用说明步骤
const USAGE_STEPS = [
  { title: '选择请求', desc: '从下拉列表中选择要测试的API请求，请求必须已保存' },
  { title: '配置参数', desc: '设置并发数、总请求数等，空值会使用默认值' },
  { title: '开始测试', desc: '点击开始按钮，系统会并发发送请求并实时统计' },
  { title: '分析结果', desc: '查看响应时间分布、状态码分布、RPS等指标' },
]

// 默认配置
const defaultConfig: StressTestConfig = {
  requestId: '',
  concurrency: undefined as any,
  totalRequests: undefined as any,
  rampUp: undefined as any,
  timeout: undefined as any,
  loadMode: 'fixed',
  variables: [],
}

// 格式化数字
const formatNum = (n: number, decimals = 2) => n.toFixed(decimals)

// 方法颜色
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500',
  POST: 'bg-blue-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-red-500',
  PATCH: 'bg-purple-500',
}

export default function StressTestPanel() {
  const { showToast } = useToast()
  const {
    getActiveProject,
    getAllRequestsWithHierarchy,
    findRequestById,
    addStressTestRecord,
    getStressTestHistory,
    setTestPanelMode,
  } = useApiStore()

  const activeProject = getActiveProject()
  const allRequestsHierarchy = getAllRequestsWithHierarchy()
  const history = getStressTestHistory()

  // 环境变量
  const envVars: Record<string, string> = {}
  const activeEnv = activeProject?.environments.find(e => e.id === activeProject?.activeEnvId)
  activeEnv?.variables.filter(v => v.enabled).forEach(v => envVars[v.key] = v.value)

  // 配置状态
  const [config, setConfig] = useState<StressTestConfig>(defaultConfig)
  const [variables, setVariables] = useState<StressTestVariable[]>([])
  const [newVarName, setNewVarName] = useState('')
  const [newVarValues, setNewVarValues] = useState('')

  // 运行状态
  const [isRunning, setIsRunning] = useState(false)
  const [metrics, setMetrics] = useState<StressTestMetrics | null>(null)
  const engineRef = useRef<StressTestEngine | null>(null)

  // UI状态
  const [showConfig, setShowConfig] = useState(true)
  const [showVariables, setShowVariables] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const selectedRequest = findRequestById(config.requestId)

  // 开始测试
  const handleStart = useCallback(async () => {
    if (!config.requestId || !selectedRequest) {
      showToast('请先选择一个请求', 'error')
      return
    }

    setIsRunning(true)
    setShowConfig(false)
    setMetrics(null)

    const testConfig = { ...config, variables }
    const engine = new StressTestEngine(testConfig, selectedRequest, envVars, setMetrics)
    engineRef.current = engine

    try {
      const finalMetrics = await engine.start()
      addStressTestRecord({
        id: crypto.randomUUID(),
        config: testConfig,
        metrics: finalMetrics,
        startTime: finalMetrics.startTime,
        endTime: finalMetrics.startTime + finalMetrics.elapsedTime,
        status: 'completed',
        requestName: selectedRequest.name,
      })
    } catch (error: any) {
      showToast(`测试失败: ${error.message}`, 'error')
    }

    setIsRunning(false)
    engineRef.current = null
  }, [config, variables, selectedRequest, envVars])

  // 停止测试
  const handleStop = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop()
      setIsRunning(false)
    }
  }, [])

  // 添加变量
  const handleAddVariable = () => {
    if (!newVarName.trim() || !newVarValues.trim()) return
    const values = newVarValues.split(',').map(v => v.trim()).filter(v => v)
    if (values.length === 0) return
    setVariables(prev => [...prev, { name: newVarName.trim(), values, mode: 'random' }])
    setNewVarName('')
    setNewVarValues('')
  }

  // 状态码颜色
  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-emerald-500'
    if (status >= 400 && status < 500) return 'bg-amber-500'
    if (status >= 500) return 'bg-red-500'
    return 'bg-gray-500'
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTestPanelMode(null)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="font-medium text-gray-700 dark:text-gray-200">压力测试</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`px-2 py-1 text-sm rounded transition ${
              showHelp ? 'bg-orange-100 text-orange-600' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <HelpCircle className="w-4 h-4 inline mr-1" />
            帮助
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-2 py-1 text-sm rounded transition ${
              showHistory ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            历史
          </button>
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!config.requestId}
              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Play className="w-4 h-4 inline mr-1" />
              开始
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition"
            >
              <Square className="w-4 h-4 inline mr-1" />
              停止
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        {/* 帮助面板 */}
        {showHelp && (
          <div className="p-4 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">使用步骤</div>
            <div className="grid grid-cols-4 gap-4">
              {USAGE_STEPS.map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center font-bold text-sm mb-2">
                    {i + 1}
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.desc}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              <div className="font-medium mb-2">参数说明：</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div><b>并发数</b>：同时发送请求的数量，建议不超过50</div>
                <div><b>总请求数</b>：总共要发送的请求次数</div>
                <div><b>爬升时间</b>：并发从0逐渐增加到目标值的秒数</div>
                <div><b>超时时间</b>：单个请求的超时毫秒数</div>
                <div><b>变量池</b>：可替换URL、Body中的变量，如 {'{{userId}}'}</div>
                <div><b>RPS</b>：每秒成功处理的请求数（吞吐量）</div>
              </div>
            </div>
          </div>
        )}
        {/* 历史面板 */}
        {showHistory && (
          <div className="p-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
            <div className="grid gap-1.5">
              {history.length === 0 ? (
                <div className="text-center py-3 text-xs text-gray-400">
                  暂无历史记录
                </div>
              ) : (
                history.slice(-5).reverse().map(r => (
                  <div key={r.id} className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between text-xs">
                      <span className="dark:text-gray-200">{r.requestName}</span>
                      <span className="text-gray-400">{new Date(r.startTime).toLocaleString()}</span>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-gray-500">
                      <span>并发 <b className="text-gray-700">{r.config.concurrency}</b></span>
                      <span>请求 <b className="text-gray-700">{r.metrics.totalSent}</b></span>
                      <span className="text-emerald-600">成功 {r.metrics.totalSuccess}</span>
                      <span className="text-red-600">失败 {r.metrics.totalFailed}</span>
                      <span>平均 {formatNum(r.metrics.avgResponseTime)}ms</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 配置面板 */}
        {showConfig && !isRunning && (
          <div className="p-3 bg-white dark:bg-gray-800">
            <div className="space-y-3">
              {/* 请求选择 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  目标请求 <span className="text-orange-500">*</span>
                </label>
                <select
                  value={config.requestId}
                  onChange={e => setConfig(prev => ({ ...prev, requestId: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">选择一个请求...</option>
                  {allRequestsHierarchy.map(({ request, projectName, folderPath }) => (
                    <option key={request.id} value={request.id}>
                      {projectName} {folderPath ? `/ ${folderPath}` : ''} / [{request.method}] {request.name || request.url.slice(0, 50)}
                    </option>
                  ))}
                </select>
                {!config.requestId && (
                  <div className="mt-1 text-xs text-orange-500">请先选择一个已保存的请求</div>
                )}
                {selectedRequest && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`px-1.5 py-0.5 rounded text-white ${METHOD_COLORS[selectedRequest.method]}`}>
                      {selectedRequest.method}
                    </span>
                    <span className="dark:text-gray-400">{selectedRequest.url}</span>
                  </div>
                )}
              </div>

              {/* 并发配置 */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    并发数
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="10"
                    value={config.concurrency ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, concurrency: e.target.value === '' ? undefined : +e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    总请求数
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="100"
                    value={config.totalRequests ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, totalRequests: e.target.value === '' ? undefined : +e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    爬升(秒)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={config.rampUp ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, rampUp: e.target.value === '' ? undefined : +e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    超时(ms)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    placeholder="30000"
                    value={config.timeout ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, timeout: e.target.value === '' ? undefined : +e.target.value }))}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* 变量池 */}
              <div>
                <button
                  onClick={() => setShowVariables(!showVariables)}
                  className="flex items-center gap-1 text-xs text-gray-500"
                >
                  <Settings2 className="w-3 h-3" />
                  变量池
                  {showVariables ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showVariables && (
                  <div className="mt-2 space-y-1">
                    {variables.map(v => (
                      <div key={v.name} className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-700 rounded">
                        <code className="text-xs text-orange-600 dark:text-orange-400">{'{{' + v.name + '}}'}</code>
                        <span className="text-xs text-gray-500">{v.values.join(', ')}</span>
                        <button onClick={() => setVariables(prev => prev.filter(x => x.name !== v.name))} className="ml-auto p-1 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-1.5">
                      <input
                        placeholder="变量名"
                        value={newVarName}
                        onChange={e => setNewVarName(e.target.value)}
                        className="flex-1 px-1.5 py-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-xs"
                      />
                      <input
                        placeholder="值(逗号分隔)"
                        value={newVarValues}
                        onChange={e => setNewVarValues(e.target.value)}
                        className="flex-1 px-1.5 py-1 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-xs"
                      />
                      <button onClick={handleAddVariable} className="px-2 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 实时指标 */}
        {(isRunning || metrics) && (
          <div className="p-4 space-y-4">
            {/* 主要指标 */}
            <div className="grid grid-cols-5 gap-2">
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 text-center">
                <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{metrics?.totalSent || 0}</div>
                <div className="text-xs text-gray-500">已发送</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 text-center">
                <div className="text-lg font-bold text-emerald-600">{metrics?.totalSuccess || 0}</div>
                <div className="text-xs text-gray-500">成功</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 text-center">
                <div className="text-lg font-bold text-red-600">{metrics?.totalFailed || 0}</div>
                <div className="text-xs text-gray-500">失败</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 text-center">
                <div className="text-lg font-bold text-blue-600">{formatNum(metrics?.requestsPerSecond || 0)}</div>
                <div className="text-xs text-gray-500">RPS</div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700 text-center">
                <div className="text-lg font-bold text-yellow-600">{formatNum(metrics?.errorRate || 0)}%</div>
                <div className="text-xs text-gray-500">错误率</div>
              </div>
            </div>

            {/* 响应时间 */}
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">响应时间 (ms)</div>
              <div className="grid grid-cols-6 gap-2 text-center">
                <div>
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatNum(metrics?.avgResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">平均</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-500">{formatNum(metrics?.minResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">最小</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-500">{formatNum(metrics?.maxResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">最大</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-blue-600">{formatNum(metrics?.p50ResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">P50</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-600">{formatNum(metrics?.p90ResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">P90</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-red-600">{formatNum(metrics?.p95ResponseTime || 0)}</div>
                  <div className="text-xs text-gray-400">P95</div>
                </div>
              </div>
            </div>

            {/* 状态码分布 */}
            {metrics && Object.keys(metrics.statusDistribution).length > 0 && (
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状态码分布</div>
                <div className="space-y-1">
                  {Object.entries(metrics.statusDistribution)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => {
                      const pct = metrics.totalSent > 0 ? (count / metrics.totalSent) * 100 : 0
                      return (
                        <div key={status} className="flex items-center gap-2">
                          <span className={`w-12 text-center px-1 py-0.5 rounded text-xs font-medium text-white ${getStatusColor(+status)}`}>
                            {status === '0' ? 'Err' : status}
                          </span>
                          <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                            <div
                              className={`h-full ${getStatusColor(+status)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">
                            {count} ({formatNum(pct)}%)
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* 空状态 */}
            {!isRunning && !metrics && (
              <div className="text-center py-8 text-gray-400">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">点击上方"帮助"了解如何使用</p>
                <p className="text-xs mt-1">选择请求后点击"开始"运行测试</p>
              </div>
            )}
          </div>
        )}

        {/* 未运行时的引导 */}
        {!isRunning && !metrics && !showConfig && (
          <div className="p-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded text-sm">
              <HelpCircle className="w-4 h-4" />
              点击"帮助"查看使用说明
            </div>
          </div>
        )}
      </div>
    </div>
  )
}