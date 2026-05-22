import React, { useState } from 'react'
import {
  FileText, CheckCircle, XCircle, SkipForward, Clock, Download,
  ChevronDown, ChevronUp, ArrowLeft, BarChart2, AlertTriangle
} from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { TestReport } from '@/types/testTypes'

// 状态图标
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'passed': return <CheckCircle className="w-5 h-5 text-emerald-500" />
    case 'failed': return <XCircle className="w-5 h-5 text-red-500" />
    case 'partial': return <AlertTriangle className="w-5 h-5 text-amber-500" />
    case 'skipped': return <SkipForward className="w-5 h-5 text-gray-400" />
    default: return <AlertTriangle className="w-5 h-5 text-gray-400" />
  }
}

// 格式时间
const formatTime = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

// 格式日期
const formatDate = (ts: number) => new Date(ts).toLocaleString()

// 状态背景色
const statusBg = (status: string) => {
  switch (status) {
    case 'passed': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
    case 'failed': return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    case 'partial': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    default: return 'bg-gray-50 dark:bg-gray-800'
  }
}

export default function TestReportPanel() {
  const { getTestReports, setTestPanelMode } = useApiStore()
  const reports = getTestReports()

  const [selectedReport, setSelectedReport] = useState<TestReport | null>(null)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  // 导出JSON
  const handleExport = (report: TestReport) => {
    const data = JSON.stringify(report, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `test-report-${new Date(report.startTime).toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <button onClick={() => selectedReport ? setSelectedReport(null) : setTestPanelMode(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <FileText className="w-4 h-4 text-green-500" />
          <span className="font-medium text-gray-700 dark:text-gray-200">测试报告</span>
          <span className="text-xs text-gray-400">{reports.length}</span>
        </div>
        {selectedReport && (
          <button onClick={() => handleExport(selectedReport)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition">
            <Download className="w-4 h-4 inline mr-1" />
            导出
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
        {reports.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>暂无测试报告</p>
            <p className="text-xs mt-1">运行测试用例后生成</p>
          </div>
        ) : selectedReport ? (
          // 报告详情
          <div className="space-y-3">
            {/* 总览 */}
            <div className={`bg-white dark:bg-gray-800 rounded-lg border ${statusBg(selectedReport.status)} p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {StatusIcon(selectedReport.status)}
                  <div>
                    <div className="text-sm font-medium dark:text-gray-200">
                      {selectedReport.suiteName || '单用例测试'}
                    </div>
                    <div className="text-xs text-gray-400">{formatDate(selectedReport.startTime)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatTime(selectedReport.duration)}</div>
                  <div className="text-xs text-gray-400">耗时</div>
                </div>
              </div>

              {/* 统计 */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-center">
                  <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{selectedReport.total}</div>
                  <div className="text-xs text-gray-400">总数</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded p-2 text-center">
                  <div className="text-lg font-bold text-emerald-600">{selectedReport.passed}</div>
                  <div className="text-xs text-emerald-500">通过</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{selectedReport.failed}</div>
                  <div className="text-xs text-red-500">失败</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-center">
                  <div className="text-lg font-bold text-gray-500">{selectedReport.skipped}</div>
                  <div className="text-xs text-gray-400">跳过</div>
                </div>
              </div>

              {/* 进度条 */}
              <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(selectedReport.passed / selectedReport.total) * 100}%` }}
                />
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${(selectedReport.failed / selectedReport.total) * 100}%` }}
                />
                <div
                  className="bg-gray-400 h-full"
                  style={{ width: `${(selectedReport.skipped / selectedReport.total) * 100}%` }}
                />
              </div>
            </div>

            {/* 用例结果 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
              <div className="px-3 py-2 border-b dark:border-gray-700 text-sm font-medium dark:text-gray-200">
                用例详情
              </div>
              <div className="p-2 space-y-1">
                {selectedReport.caseResults.map(result => (
                  <div key={result.testCaseId} className="bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div
                      onClick={() => setExpandedCase(expandedCase === result.testCaseId ? null : result.testCaseId)}
                      className="flex items-center justify-between p-2 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {StatusIcon(result.status)}
                        <span className="text-sm dark:text-gray-200">{result.testCaseName}</span>
                        <span className="text-xs text-gray-400">{result.request.method}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{formatTime(result.responseTime)}</span>
                        {expandedCase === result.testCaseId ? (
                          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* 展开详情 */}
                    {expandedCase === result.testCaseId && (
                      <div className="px-3 pb-2 space-y-1 border-t dark:border-gray-600">
                        {/* 响应 */}
                        {result.response && (
                          <div className="flex gap-4 text-xs text-gray-500 mt-1">
                            <span>Status: <b className={result.response.status < 400 ? 'text-emerald-600' : 'text-red-600'}>{result.response.status}</b></span>
                            <span>Time: <b>{formatTime(result.response.time)}</b></span>
                            <span>Size: <b>{result.response.size}B</b></span>
                          </div>
                        )}

                        {/* 断言 */}
                        <div className="text-xs text-gray-500 mt-1">断言结果</div>
                        {result.assertionResults.map(ar => (
                          <div
                            key={ar.assertionId}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              ar.passed
                                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                : 'bg-red-50 dark:bg-red-900/20'
                            }`}
                          >
                            {ar.passed ? (
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500" />
                            )}
                            <span className="font-medium">{ar.assertionType}</span>
                            {!ar.passed && ar.error && (
                              <span className="text-red-500 ml-1">{ar.error}</span>
                            )}
                          </div>
                        ))}

                        {/* 错误 */}
                        {result.error && (
                          <div className="px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600">
                            错误: {result.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // 报告列表
          <div className="space-y-1">
            {reports.slice().reverse().map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`bg-white dark:bg-gray-800 rounded-lg border cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition p-3 ${statusBg(report.status)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {StatusIcon(report.status)}
                    <div>
                      <div className="text-sm dark:text-gray-200">{report.suiteName || '单用例测试'}</div>
                      <div className="text-xs text-gray-400">{formatDate(report.createdAt)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-700 dark:text-gray-300">{formatTime(report.duration)}</div>
                    <div className="flex gap-1 text-xs mt-0.5">
                      <span className="text-emerald-500">{report.passed} 通过</span>
                      {report.failed > 0 && <span className="text-red-500">{report.failed} 失败</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}