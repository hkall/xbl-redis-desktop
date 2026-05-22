import React, { useState, useCallback } from 'react'
import {
  Layers, Plus, Trash2, Edit2, Play, ChevronDown, ChevronUp,
  ArrowLeft, CheckCircle, XCircle, Settings2, Loader2
} from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { TestSuite } from '@/types/testTypes'
import { useToast } from '@/components/common/Toast'
import { runTestSuite } from '@/utils/testRunner'

export default function TestSuitePanel() {
  const { showToast } = useToast()
  const {
    getTestCases,
    addTestSuite,
    updateTestSuite,
    deleteTestSuite,
    getTestSuites,
    findRequestById,
    getActiveProject,
    addTestReport,
    setTestPanelMode,
  } = useApiStore()

  const testCases = getTestCases()
  const testSuites = getTestSuites()

  // 环境变量
  const envVars: Record<string, string> = {}
  const activeProject = getActiveProject()
  const activeEnv = activeProject?.environments.find(e => e.id === activeProject?.activeEnvId)
  activeEnv?.variables.filter(v => v.enabled).forEach(v => envVars[v.key] = v.value)

  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [runningSuiteId, setRunningSuiteId] = useState<string | null>(null)
  const [runningProgress, setRunningProgress] = useState<{ results: any[]; currentCase: string } | null>(null)

  // 创建
  const handleCreate = () => {
    setIsCreating(true)
    setEditingSuite({
      id: '',
      name: '新测试套件',
      testCaseIds: [],
      executionMode: 'sequential',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  // 编辑
  const handleEdit = (suite: TestSuite) => {
    setIsCreating(false)
    setEditingSuite({ ...suite })
  }

  // 保存
  const handleSave = () => {
    if (!editingSuite?.name.trim()) {
      showToast('请输入套件名称', 'error')
      return
    }
    if (isCreating) {
      addTestSuite(editingSuite)
      showToast('创建成功', 'success')
    } else {
      updateTestSuite(editingSuite.id, editingSuite)
      showToast('更新成功', 'success')
    }
    setEditingSuite(null)
    setIsCreating(false)
  }

  // 删除
  const handleDelete = (id: string) => {
    deleteTestSuite(id)
    showToast('删除成功', 'success')
  }

  // 运行套件
  const handleRunSuite = async (suite: TestSuite) => {
    const cases = testCases.filter(tc => suite.testCaseIds.includes(tc.id) && tc.enabled)
    if (cases.length === 0) {
      showToast('套件中没有可运行的用例', 'error')
      return
    }

    setRunningSuiteId(suite.id)
    setRunningProgress({ results: [], currentCase: '' })

    try {
      const report = await runTestSuite(
        cases,
        findRequestById,
        envVars,
        {
          executionMode: suite.executionMode,
          caseDelay: suite.caseDelay,
          stopOnFailure: suite.stopOnFailure,
        },
        (results, currentCase) => setRunningProgress({ results, currentCase })
      )

      report.suiteId = suite.id
      report.suiteName = suite.name
      addTestReport(report)

      showToast(
        report.status === 'passed' ? `全部通过 (${report.passed}/${report.total})` : `有失败 (${report.failed}/${report.total})`,
        report.status === 'passed' ? 'success' : 'error'
      )
    } catch (e: any) {
      showToast(`运行失败: ${e.message}`, 'error')
    }

    setRunningSuiteId(null)
    setRunningProgress(null)
  }

  // 切换用例选择
  const handleToggleCase = (id: string) => {
    if (!editingSuite) return
    const newIds = editingSuite.testCaseIds.includes(id)
      ? editingSuite.testCaseIds.filter(x => x !== id)
      : [...editingSuite.testCaseIds, id]
    setEditingSuite({ ...editingSuite, testCaseIds: newIds })
  }

  // 用例名
  const getCaseName = (id: string) => testCases.find(c => c.id === id)?.name || '未知'

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => setTestPanelMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <Layers className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-gray-700 dark:text-gray-200">测试套件</span>
          <span className="text-xs text-gray-400">{testSuites.length}</span>
        </div>
        <button onClick={handleCreate} className="px-3 py-1.5 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition">
          <Plus className="w-4 h-4 inline mr-1" />
          新建
        </button>
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
        {/* 编辑面板 */}
        {editingSuite && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 mb-3">
            <div className="space-y-3">
              {/* 名称 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">套件名称</label>
                <input
                  type="text"
                  value={editingSuite.name}
                  onChange={e => setEditingSuite({ ...editingSuite, name: e.target.value })}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 执行模式 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">执行模式</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={editingSuite.executionMode === 'sequential'}
                      onChange={() => setEditingSuite({ ...editingSuite, executionMode: 'sequential' })}
                      className="w-3 h-3 accent-purple-500"
                    />
                    <span className="text-xs">顺序执行</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={editingSuite.executionMode === 'parallel'}
                      onChange={() => setEditingSuite({ ...editingSuite, executionMode: 'parallel' })}
                      className="w-3 h-3 accent-purple-500"
                    />
                    <span className="text-xs">并行执行</span>
                  </label>
                </div>
              </div>

              {/* 用例选择 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  包含用例 ({editingSuite.testCaseIds.length} 已选)
                </label>
                <div className="space-y-0.5 max-h-36 overflow-auto bg-gray-50 dark:bg-gray-700 rounded p-1.5">
                  {testCases.length === 0 ? (
                    <div className="text-xs text-gray-400 py-1">暂无可用测试用例</div>
                  ) : (
                    testCases.map(tc => (
                      <label
                        key={tc.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded cursor-pointer ${
                          editingSuite.testCaseIds.includes(tc.id)
                            ? 'bg-purple-100 dark:bg-purple-900/30'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={editingSuite.testCaseIds.includes(tc.id)}
                          onChange={() => handleToggleCase(tc.id)}
                          className="w-3 h-3 accent-purple-500"
                        />
                        <span className="text-xs">{tc.name}</span>
                        <span className="text-xs text-gray-400">{tc.assertions.length} 断言</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-1.5 pt-2 border-t dark:border-gray-700">
                <button onClick={() => setEditingSuite(null)} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded text-xs hover:bg-gray-200">
                  取消
                </button>
                <button onClick={handleSave} className="px-3 py-1.5 bg-purple-500 text-white rounded text-xs hover:bg-purple-600">
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 运行进度 */}
        {runningProgress && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3 mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
              <span className="text-xs dark:text-gray-200">正在运行: {runningProgress.currentCase}</span>
            </div>
            <div className="mt-2 flex gap-3">
              <span className="text-xs text-emerald-600">✓ {runningProgress.results.filter(r => r.status === 'passed').length}</span>
              <span className="text-xs text-red-600">✗ {runningProgress.results.filter(r => r.status === 'failed').length}</span>
            </div>
          </div>
        )}

        {/* 套件列表 */}
        <div className="space-y-1">
          {testSuites.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>暂无测试套件</p>
              <p className="text-xs mt-1">点击上方"新建"开始</p>
            </div>
          ) : (
            testSuites.map(suite => {
              const isRunning = runningSuiteId === suite.id
              const cases = testCases.filter(tc => suite.testCaseIds.includes(tc.id))

              return (
                <div key={suite.id} className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-sm dark:text-gray-200">{suite.name}</span>
                      <span className="text-xs text-gray-400">
                        {suite.testCaseIds.length} 用例 · {suite.executionMode === 'sequential' ? '顺序' : '并行'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRunSuite(suite)}
                        disabled={isRunning || suite.testCaseIds.length === 0}
                        className={`p-1.5 rounded transition ${
                          isRunning
                            ? 'bg-purple-100 text-purple-500 animate-pulse'
                            : 'text-gray-400 hover:text-purple-500 hover:bg-gray-100'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleEdit(suite)} className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-gray-100 rounded">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(suite.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 用例列表 */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cases.map(c => (
                      <span key={c.id} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-500">
                        {c.name}
                      </span>
                    ))}
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