import { TestCase, CaseResult, AssertionResult, TestReport } from '@/types/testTypes'
import { SavedRequest, ResponseData } from '@/store/types'
import { prepareRequest, executeRequest } from './stressEngine'
import { executeAssertions, allAssertionsPassed, extractVariables, ResponseDataForAssertion } from './assertionEngine'

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// 运行单个测试用例（支持多次执行和重试）
export async function runTestCase(
  testCase: TestCase,
  savedRequest: SavedRequest,
  envVars: Record<string, string>,
  onProgress?: (result: CaseResult) => void
): Promise<CaseResult> {
  const startTime = Date.now()
  const iterations = testCase.iterations || 1
  const iterationDelay = testCase.iterationDelay || 0
  const retryCount = testCase.retryCount || 0
  const retryDelay = testCase.retryDelay || 1000

  // 合并前置变量
  const mergedVars = { ...envVars, ...testCase.preRequest?.variables }

  // 最终结果
  const finalResult: CaseResult = {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    status: 'passed',
    request: {
      method: savedRequest.method,
      url: savedRequest.url,
    },
    assertionResults: [],
    startTime,
    endTime: 0,
    responseTime: 0,
    extractedVariables: {},
  }

  let totalResponseTime = 0
  let allIterationsPassed = true
  let lastError: string | undefined

  // 执行多次迭代
  for (let iter = 0; iter < iterations; iter++) {
    // 前置延迟（只在第一次迭代执行）
    if (iter === 0 && testCase.preRequest?.delay) {
      await delay(testCase.preRequest.delay)
    }

    // 迭代间延迟
    if (iter > 0 && iterationDelay > 0) {
      await delay(iterationDelay)
    }

    // 准备请求
    const prepared = prepareRequest(savedRequest, mergedVars, [], iter)
    const timeout = testCase.timeout || savedRequest.timeout || 30000
    const requestId = crypto.randomUUID()

    let iterationPassed = false
    let retriesUsed = 0

    // 重试机制
    for (let retry = 0; retry <= retryCount; retry++) {
      if (retry > 0) {
        await delay(retryDelay)
        retriesUsed = retry
      }

      // 执行请求
      const stressResult = await executeRequest(prepared, timeout, requestId)

      if (stressResult.success) {
        const iterationResult: CaseResult = {
          ...finalResult,
          response: {
            status: stressResult.status || 0,
            statusText: stressResult.statusText || '',
            time: stressResult.responseTime,
            size: stressResult.responseSize || 0,
            body: '',
          },
          responseTime: stressResult.responseTime,
          retryCount: retriesUsed,
        }

        totalResponseTime += stressResult.responseTime

        // 构建断言响应数据
        const assertionResponse: ResponseDataForAssertion = {
          status: stressResult.status || 0,
          statusText: stressResult.statusText || '',
          headers: {},
          body: '',
          time: stressResult.responseTime,
          size: stressResult.responseSize || 0,
        }

        // 执行断言
        const assertionResults = executeAssertions(testCase.assertions, assertionResponse)

        if (allAssertionsPassed(assertionResults)) {
          iterationPassed = true
          // 只在第一次成功的迭代中收集断言结果和变量
          if (iter === 0) {
            finalResult.assertionResults = assertionResults
            if (testCase.postRequest?.extractVariables) {
              finalResult.extractedVariables = extractVariables(
                testCase.postRequest.extractVariables as any,
                assertionResponse
              )
            }
          }
          break // 跳出重试循环
        } else {
          lastError = '断言未通过'
          if (iter === 0 && retry === retryCount) {
            finalResult.assertionResults = assertionResults
          }
        }
      } else {
        lastError = stressResult.error || 'Request failed'
        totalResponseTime += stressResult.responseTime
      }
    }

    if (!iterationPassed) {
      allIterationsPassed = false
    }
  }

  // 设置最终状态
  if (!allIterationsPassed) {
    finalResult.status = 'failed'
    finalResult.error = lastError
  }
  finalResult.responseTime = iterations > 0 ? totalResponseTime / iterations : 0
  finalResult.endTime = Date.now()

  // 回调进度
  if (onProgress) {
    onProgress(finalResult)
  }

  return finalResult
}

// 运行测试套件
export async function runTestSuite(
  testCases: TestCase[],
  findRequestById: (id: string) => SavedRequest | null,
  envVars: Record<string, string>,
  suiteConfig: {
    executionMode: 'sequential' | 'parallel'
    caseDelay?: number
    stopOnFailure?: boolean
  },
  onProgress?: (results: CaseResult[], currentCase: string) => void
): Promise<TestReport> {
  const startTime = Date.now()
  const results: CaseResult[] = []
  let collectedVars: Record<string, string> = { ...envVars }

  // 获取有效的测试用例
  const validCases = testCases.filter(tc => tc.enabled && tc.requestId)

  for (const testCase of validCases) {
    if (suiteConfig.stopOnFailure && results.some(r => r.status === 'failed')) {
      // 跳过剩余用例
      results.push({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: 'skipped',
        request: { method: '', url: '' },
        assertionResults: [],
        startTime: Date.now(),
        endTime: Date.now(),
        responseTime: 0,
      })
      continue
    }

    const request = findRequestById(testCase.requestId)
    if (!request) {
      results.push({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        status: 'skipped',
        request: { method: '', url: '' },
        assertionResults: [],
        error: 'Request not found',
        startTime: Date.now(),
        endTime: Date.now(),
        responseTime: 0,
      })
      continue
    }

    // 合入之前提取的变量
    const mergedVars = { ...collectedVars }

    // 运行用例
    const result = await runTestCase(testCase, request, mergedVars)

    // 收集提取的变量
    if (result.extractedVariables) {
      collectedVars = { ...collectedVars, ...result.extractedVariables }
    }

    results.push(result)

    // 回调进度
    if (onProgress) {
      onProgress(results, testCase.name)
    }

    // 用例间延迟
    if (suiteConfig.caseDelay && suiteConfig.executionMode === 'sequential') {
      await new Promise(resolve => setTimeout(resolve, suiteConfig.caseDelay))
    }
  }

  const endTime = Date.now()

  // 生成报告
  const report: TestReport = {
    id: crypto.randomUUID(),
    startTime,
    endTime,
    duration: endTime - startTime,
    status: results.every(r => r.status === 'passed') ? 'passed'
      : results.every(r => r.status === 'failed') ? 'failed'
      : 'partial',
    total: validCases.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    caseResults: results,
    createdAt: Date.now(),
  }

  return report
}