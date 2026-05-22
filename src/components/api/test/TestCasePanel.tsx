import React, { useState, useCallback } from 'react'
import { Play, Plus, Trash2, Edit2, FileCode, ArrowLeft, Settings2, ChevronDown, ChevronUp } from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { TestCase, Assertion, AssertionType, AssertionCondition } from '@/types/testTypes'
import { useToast } from '@/components/common/Toast'
import { runTestCase } from '@/utils/testRunner'

// 断言类型
const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
  { value: 'status', label: '状态码' },
  { value: 'header', label: '响应头' },
  { value: 'body', label: '响应体' },
  { value: 'time', label: '响应时间' },
  { value: 'json', label: 'JSON路径' },
]

// 断言条件
const ASSERTION_CONDITIONS: { value: AssertionCondition; label: string }[] = [
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'notContains', label: '不包含' },
  { value: 'matches', label: '正则匹配' },
  { value: 'greaterThan', label: '大于' },
  { value: 'lessThan', label: '小于' },
  { value: 'exists', label: '存在' },
  { value: 'notExists', label: '不存在' },
]

// 默认断言
const createAssertion = (): Assertion => ({
  id: crypto.randomUUID(),
  type: 'status',
  condition: 'equals',
  expected: 200,
  enabled: true,
})

// 方法颜色
const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-500 bg-emerald-50',
  POST: 'text-blue-500 bg-blue-50',
  PUT: 'text-amber-500 bg-amber-50',
  DELETE: 'text-red-500 bg-red-50',
  PATCH: 'text-purple-500 bg-purple-50',
}

export default function TestCasePanel() {
  const { showToast } = useToast()
  const {
    getActiveProject,
    getAllRequestsWithHierarchy,
    findRequestById,
    addTestCase,
    updateTestCase,
    deleteTestCase,
    getTestCases,
    addTestReport,
    setTestPanelMode,
  } = useApiStore()

  const allRequestsHierarchy = getAllRequestsWithHierarchy()
  const testCases = getTestCases()

  // 环境变量
  const envVars: Record<string, string> = {}
  const activeProject = getActiveProject()
  const activeEnv = activeProject?.environments.find(e => e.id === activeProject?.activeEnvId)
  activeEnv?.variables.filter(v => v.enabled).forEach(v => envVars[v.key] = v.value)

  // 状态
  const [editingCase, setEditingCase] = useState<TestCase | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [runningCaseId, setRunningCaseId] = useState<string | null>(null)
  const [showExecConfig, setShowExecConfig] = useState(false)

  // 创建
  const handleCreate = () => {
    setIsCreating(true)
    setEditingCase({
      id: '',
      name: '新测试用例',
      requestId: '',
      assertions: [createAssertion()],
      iterations: undefined as any,
      iterationDelay: undefined as any,
      timeout: undefined as any,
      retryCount: undefined as any,
      retryDelay: undefined as any,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  // 编辑
  const handleEdit = (tc: TestCase) => {
    setIsCreating(false)
    setEditingCase({ ...tc })
  }

  // 保存
  const handleSave = () => {
    if (!editingCase?.requestId) {
      showToast('请选择关联请求', 'error')
      return
    }
    if (!editingCase.name.trim()) {
      showToast('请输入用例名称', 'error')
      return
    }
    if (isCreating) {
      addTestCase(editingCase)
      showToast('创建成功', 'success')
    } else {
      updateTestCase(editingCase.id, editingCase)
      showToast('更新成功', 'success')
    }
    setEditingCase(null)
    setIsCreating(false)
  }

  // 删除
  const handleDelete = (id: string) => {
    deleteTestCase(id)
    showToast('删除成功', 'success')
  }

  // 运行单个用例
  const handleRunCase = async (tc: TestCase) => {
    const request = findRequestById(tc.requestId)
    if (!request) {
      showToast('找不到关联请求', 'error')
      return
    }

    setRunningCaseId(tc.id)
    const iterations = tc.iterations || 1
    showToast(`正在运行测试 (${iterations}次)...`, 'info')

    try {
      const result = await runTestCase(tc, request, envVars)

      // 生成报告
      addTestReport({
        id: crypto.randomUUID(),
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.endTime - result.startTime,
        status: result.status === 'passed' ? 'passed' : 'failed',
        total: iterations,
        passed: result.status === 'passed' ? iterations : 0,
        failed: result.status === 'failed' ? iterations : 0,
        skipped: 0,
        caseResults: [result],
        createdAt: Date.now(),
      })

      showToast(
        result.status === 'passed' ? `测试通过 (${iterations}次)` : `测试失败: ${result.error || '断言未通过'}`,
        result.status === 'passed' ? 'success' : 'error'
      )
    } catch (e: any) {
      showToast(`运行失败: ${e.message}`, 'error')
    }

    setRunningCaseId(null)
  }

  // 添加断言
  const handleAddAssertion = () => {
    if (!editingCase) return
    setEditingCase({ ...editingCase, assertions: [...editingCase.assertions, createAssertion()] })
  }

  // 更新断言
  const handleUpdateAssertion = (id: string, updates: Partial<Assertion>) => {
    if (!editingCase) return
    setEditingCase({
      ...editingCase,
      assertions: editingCase.assertions.map(a => a.id === id ? { ...a, ...updates } : a),
    })
  }

  // 删除断言
  const handleDeleteAssertion = (id: string) => {
    if (!editingCase) return
    setEditingCase({
      ...editingCase,
      assertions: editingCase.assertions.filter(a => a.id !== id),
    })
  }

  // 获取请求信息
  const getRequestInfo = (id: string) => {
    const item = allRequestsHierarchy.find(item => item.request.id === id)
    return item ? {
      method: item.request.method,
      name: item.request.name || item.request.url,
      projectName: item.projectName,
      folderPath: item.folderPath,
    } : null
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => setTestPanelMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <FileCode className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-gray-700 dark:text-gray-200">测试用例</span>
          <span className="text-xs text-gray-400">{testCases.length}</span>
        </div>
        <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition">
          <Plus className="w-4 h-4 inline mr-1" />
          新建
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
        {/* 编辑面板 */}
        {editingCase && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 mb-3">
            <div className="space-y-3">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">用例名称</label>
                  <input
                    type="text"
                    value={editingCase.name}
                    onChange={e => setEditingCase({ ...editingCase, name: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">关联请求</label>
                  <select
                    value={editingCase.requestId}
                    onChange={e => setEditingCase({ ...editingCase, requestId: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">选择请求...</option>
                    {allRequestsHierarchy.map(({ request, projectName, folderPath }) => (
                      <option key={request.id} value={request.id}>
                        {projectName} {folderPath ? `/ ${folderPath}` : ''} / [{request.method}] {request.name || request.url.slice(0, 50)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 执行配置 */}
              <div>
                <button
                  onClick={() => setShowExecConfig(!showExecConfig)}
                  className="flex items-center gap-1 text-xs text-gray-500 mb-2"
                >
                  <Settings2 className="w-3 h-3" />
                  执行配置
                  {showExecConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {showExecConfig && (
                  <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">执行次数</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="1"
                        value={editingCase.iterations ?? ''}
                        onChange={e => setEditingCase({ ...editingCase, iterations: e.target.value === '' ? undefined : +e.target.value })}
                        className="w-full px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">间隔(ms)</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editingCase.iterationDelay ?? ''}
                        onChange={e => setEditingCase({ ...editingCase, iterationDelay: e.target.value === '' ? undefined : +e.target.value })}
                        className="w-full px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">超时(ms)</label>
                      <input
                        type="number"
                        min={1000}
                        placeholder="30000"
                        value={editingCase.timeout ?? ''}
                        onChange={e => setEditingCase({ ...editingCase, timeout: e.target.value === '' ? undefined : +e.target.value })}
                        className="w-full px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">重试次数</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={editingCase.retryCount ?? ''}
                        onChange={e => setEditingCase({ ...editingCase, retryCount: e.target.value === '' ? undefined : +e.target.value })}
                        className="w-full px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">重试间隔</label>
                      <input
                        type="number"
                        min={0}
                        placeholder="1000"
                        value={editingCase.retryDelay ?? ''}
                        onChange={e => setEditingCase({ ...editingCase, retryDelay: e.target.value === '' ? undefined : +e.target.value })}
                        className="w-full px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 断言列表 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500">断言配置</label>
                  <button onClick={handleAddAssertion} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded text-xs hover:bg-blue-100">
                    <Plus className="w-3 h-3 inline mr-0.5" />
                    添加
                  </button>
                </div>
                <div className="space-y-1">
                  {editingCase.assertions.map(a => (
                    <div key={a.id} className="flex items-center gap-1.5 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      {/* 类型 */}
                      <select
                        value={a.type}
                        onChange={e => handleUpdateAssertion(a.id, { type: e.target.value as AssertionType })}
                        className="px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      >
                        {ASSERTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>

                      {/* 目标 */}
                      {(a.type === 'header' || a.type === 'json') && (
                        <input
                          type="text"
                          placeholder={a.type === 'header' ? 'Header名' : '$.data.id'}
                          value={a.target || ''}
                          onChange={e => handleUpdateAssertion(a.id, { target: e.target.value })}
                          className="flex-1 px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                        />
                      )}

                      {/* 条件 */}
                      <select
                        value={a.condition}
                        onChange={e => handleUpdateAssertion(a.id, { condition: e.target.value as AssertionCondition })}
                        className="px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                      >
                        {ASSERTION_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>

                      {/* 预期值 */}
                      {a.condition !== 'exists' && a.condition !== 'notExists' && (
                        <input
                          type="text"
                          placeholder="预期值"
                          value={String(a.expected)}
                          onChange={e => handleUpdateAssertion(a.id, {
                            expected: a.type === 'status' || a.type === 'time' ? +e.target.value || 0 : e.target.value
                          })}
                          className="flex-1 px-1.5 py-1 bg-white dark:bg-gray-600 border-0 rounded text-xs"
                        />
                      )}

                      {/* 删除 */}
                      <button onClick={() => handleDeleteAssertion(a.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-1.5 pt-2 border-t dark:border-gray-700">
                <button onClick={() => setEditingCase(null)} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200">
                  取消
                </button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 用例列表 */}
        <div className="space-y-1">
          {testCases.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无测试用例</p>
              <p className="text-xs mt-1">点击上方"新建"开始</p>
            </div>
          ) : (
            testCases.map(tc => {
              const req = getRequestInfo(tc.requestId)
              const isRunning = runningCaseId === tc.id

              return (
                <div key={tc.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${tc.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      <span className="text-sm dark:text-gray-200">{tc.name}</span>
                      {req && (
                        <span className={`px-1.5 py-0.5 rounded text-xs ${METHOD_COLORS[req.method]}`}>
                          {req.method}
                        </span>
                      )}
                      {(tc.iterations || 1) > 1 && (
                        <span className="text-xs text-gray-400">×{tc.iterations}</span>
                      )}
                      {(tc.retryCount || 0) > 0 && (
                        <span className="text-xs text-orange-400">重试{tc.retryCount}</span>
                      )}
                      {req && <span className="text-xs text-gray-400 truncate max-w-[150px]">{req.name}</span>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRunCase(tc)}
                        disabled={isRunning || !tc.requestId}
                        className={`p-1.5 rounded transition ${
                          isRunning
                            ? 'bg-blue-100 text-blue-500 animate-pulse'
                            : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(tc)} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(tc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 断言预览 */}
                  <div className="mt-2 flex gap-1">
                    {tc.assertions.map(a => {
                      const typeInfo = ASSERTION_TYPES.find(t => t.value === a.type)
                      return (
                        <span key={a.id} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500">
                          {typeInfo?.label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}