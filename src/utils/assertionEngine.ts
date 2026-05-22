import { Assertion, AssertionResult, AssertionType, AssertionCondition } from '@/types/testTypes'
import { getJsonPathValue, jsonPathExists } from './jsonPath'

// 响应数据结构
export interface ResponseDataForAssertion {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number   // ms
  size: number   // bytes
}

// 解析 JSON 响应体
function parseJsonBody(body: string): any {
  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

// 执行单个断言
export function executeAssertion(
  assertion: Assertion,
  response: ResponseDataForAssertion
): AssertionResult {
  const result: AssertionResult = {
    assertionId: assertion.id,
    assertionType: assertion.type,
    passed: false,
    actualValue: undefined,
    expectedValue: assertion.expected,
  }

  try {
    let actualValue: any

    // 获取实际值
    switch (assertion.type) {
      case 'status':
        actualValue = response.status
        break

      case 'header':
        if (!assertion.target) {
          result.error = 'Header name is required'
          return result
        }
        actualValue = response.headers[assertion.target.toLowerCase()] || response.headers[assertion.target]
        break

      case 'body':
        actualValue = response.body
        break

      case 'time':
        actualValue = response.time
        break

      case 'json':
        if (!assertion.target) {
          result.error = 'JSON path is required'
          return result
        }
        const jsonBody = parseJsonBody(response.body)
        if (jsonBody === null) {
          result.error = 'Response body is not valid JSON'
          return result
        }
        const values = getJsonPathValue(jsonBody, assertion.target)
        if (values.length === 0) {
          result.error = `JSON path '${assertion.target}' not found`
          return result
        }
        actualValue = values[0]
        break

      case 'custom':
        // 自定义脚本执行（预留）
        result.error = 'Custom assertions not yet implemented'
        return result

      default:
        result.error = `Unknown assertion type: ${assertion.type}`
        return result
    }

    result.actualValue = actualValue

    // 执行断言条件
    result.passed = evaluateCondition(actualValue, assertion.condition, assertion.expected)

    if (!result.passed) {
      result.error = generateAssertionError(assertion, actualValue)
    }
  } catch (error: any) {
    result.error = error.message || 'Assertion execution failed'
  }

  return result
}

// 评估断言条件
function evaluateCondition(actual: any, condition: AssertionCondition, expected: any): boolean {
  switch (condition) {
    case 'equals':
      return actual === expected

    case 'notEquals':
      return actual !== expected

    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.includes(expected)
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected)
      }
      return false

    case 'notContains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return !actual.includes(expected)
      }
      if (Array.isArray(actual)) {
        return !actual.includes(expected)
      }
      return true

    case 'matches':
      if (typeof actual === 'string' && typeof expected === 'string') {
        try {
          const regex = new RegExp(expected)
          return regex.test(actual)
        } catch {
          return false
        }
      }
      return false

    case 'greaterThan':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual > expected
      }
      return false

    case 'lessThan':
      if (typeof actual === 'number' && typeof expected === 'number') {
        return actual < expected
      }
      return false

    case 'exists':
      return actual !== undefined && actual !== null

    case 'notExists':
      return actual === undefined || actual === null

    case 'typeOf':
      const actualType = typeof actual
      if (Array.isArray(actual)) return expected === 'array'
      if (actual === null) return expected === 'null'
      return actualType === expected

    case 'arrayLength':
      if (Array.isArray(actual) && typeof expected === 'number') {
        return actual.length === expected
      }
      return false

    default:
      return false
  }
}

// 生成断言错误信息
function generateAssertionError(assertion: Assertion, actual: any): string {
  const conditionText = getConditionText(assertion.condition)
  const expectedText = formatValue(assertion.expected)
  const actualText = formatValue(actual)

  return `${assertion.type}${assertion.target ? `(${assertion.target})` : ''}: expected ${conditionText} ${expectedText}, but got ${actualText}`
}

// 获取条件文本
function getConditionText(condition: AssertionCondition): string {
  const texts: Record<AssertionCondition, string> = {
    equals: 'to equal',
    notEquals: 'to not equal',
    contains: 'to contain',
    notContains: 'to not contain',
    matches: 'to match',
    greaterThan: 'to be greater than',
    lessThan: 'to be less than',
    exists: 'to exist',
    notExists: 'to not exist',
    typeOf: 'to be type of',
    arrayLength: 'to have length',
  }
  return texts[condition] || condition
}

// 格式化值
function formatValue(value: any): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

// 执行所有断言
export function executeAssertions(
  assertions: Assertion[],
  response: ResponseDataForAssertion
): AssertionResult[] {
  return assertions.filter(a => a.enabled).map(a => executeAssertion(a, response))
}

// 检查所有断言是否通过
export function allAssertionsPassed(results: AssertionResult[]): boolean {
  return results.every(r => r.passed)
}

// 从响应中提取变量
export interface VariableExtraction {
  name: string
  source: 'body' | 'header'
  path?: string
  regex?: string
  regexGroup?: number
}

export function extractVariables(
  extractions: VariableExtraction[],
  response: ResponseDataForAssertion
): Record<string, string> {
  const result: Record<string, string> = {}

  for (const extraction of extractions) {
    try {
      if (extraction.source === 'header' && extraction.path) {
        const value = response.headers[extraction.path.toLowerCase()] || response.headers[extraction.path]
        if (value) {
          result[extraction.name] = value
        }
      } else if (extraction.source === 'body') {
        if (extraction.regex) {
          // 正则提取
          const regex = new RegExp(extraction.regex)
          const match = response.body.match(regex)
          if (match) {
            const groupIndex = extraction.regexGroup || 0
            result[extraction.name] = match[groupIndex] || match[0]
          }
        } else if (extraction.path) {
          // JSONPath 提取
          const jsonBody = parseJsonBody(response.body)
          if (jsonBody !== null) {
            const values = getJsonPathValue(jsonBody, extraction.path)
            if (values.length > 0) {
              result[extraction.name] = String(values[0])
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to extract variable ${extraction.name}:`, error)
    }
  }

  return result
}