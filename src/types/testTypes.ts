// ==================== 压力测试类型 ====================

// 压力测试配置
export interface StressTestConfig {
  requestId: string            // 关联的SavedRequest ID
  targetUrl?: string           // 目标URL（可覆盖请求中的URL）

  // 并发配置
  concurrency: number          // 并发数 (1-100)
  totalRequests?: number       // 总请求次数
  duration?: number            // 持续时间(秒) - 与totalRequests二选一

  // 启动配置
  rampUp: number               // 启动爬升时间(秒)
  thinkTime?: number           // 请求间隔(毫秒)

  // 超时配置
  timeout: number              // 单请求超时(毫秒)

  // 负载模式
  loadMode: 'fixed' | 'incremental' | 'peak'

  // 变量池（用于随机替换请求参数）
  variables?: StressTestVariable[]
}

// 压力测试变量
export interface StressTestVariable {
  name: string                 // 变量名 {{name}}
  values: string[]             // 值列表（随机选取）
  mode: 'random' | 'sequence' | 'round-robin'  // 选择模式
}

// 单次请求结果
export interface StressTestResult {
  requestId: string            // 内部请求ID（用于追踪）
  success: boolean
  status?: number
  statusText?: string
  responseTime: number         // 响应时间(ms)
  responseSize?: number        // 响应大小(bytes)
  error?: string
  timestamp: number
}

// 实时统计指标
export interface StressTestMetrics {
  // 实时统计
  totalSent: number            // 已发送请求
  totalSuccess: number         // 成功数
  totalFailed: number          // 失败数

  // 性能指标
  avgResponseTime: number      // 平均响应时间(ms)
  minResponseTime: number      // 最小响应时间(ms)
  maxResponseTime: number      // 最大响应时间(ms)
  p50ResponseTime: number      // P50响应时间(ms)
  p90ResponseTime: number      // P90响应时间(ms)
  p95ResponseTime: number      // P95响应时间(ms)
  p99ResponseTime: number      // P99响应时间(ms)

  // 吞吐量
  requestsPerSecond: number    // RPS
  bytesPerSecond: number       // BPS
  totalBytes: number           // 总传输字节数

  // 错误统计
  errorRate: number            // 错误率(%)
  errorsByType: Record<string, number>  // 按错误类型统计

  // 状态码分布
  statusDistribution: Record<number, number>

  // 时间轴数据（用于图表）
  timeline: TimelinePoint[]

  // 运行时间
  startTime: number
  elapsedTime: number          // 已运行时间(ms)
}

// 时间轴数据点
export interface TimelinePoint {
  timestamp: number            // 时间戳(ms)
  rps: number                  // 该时刻RPS
  avgTime: number              // 该时刻平均响应时间
  successCount: number         // 该时刻成功数
  failCount: number            // 该时刻失败数
}

// 压力测试历史记录
export interface StressTestRecord {
  id: string
  config: StressTestConfig
  metrics: StressTestMetrics
  startTime: number
  endTime: number
  status: 'completed' | 'cancelled' | 'error'
  requestName?: string         // 关联的请求名称
}

// ==================== 自动化测试类型 ====================

// 断言类型
export type AssertionType = 'status' | 'header' | 'body' | 'time' | 'json' | 'custom'

// 断言条件
export type AssertionCondition =
  | 'equals'           // 等于
  | 'notEquals'        // 不等于
  | 'contains'         // 包含
  | 'notContains'      // 不包含
  | 'matches'          // 正则匹配
  | 'greaterThan'      // 大于
  | 'lessThan'         // 小于
  | 'exists'           // 存在
  | 'notExists'        // 不存在
  | 'typeOf'           // 类型判断
  | 'arrayLength'      // 数组长度

// 断言配置
export interface Assertion {
  id: string
  type: AssertionType

  // 断言目标
  target?: string             // header名、json路径等

  // 断言条件
  condition: AssertionCondition

  // 预期值
  expected: any

  // 描述
  description?: string

  // 是否启用
  enabled: boolean
}

// 变量提取配置
export interface VariableExtraction {
  name: string                // 变量名
  source: 'body' | 'header'   // 来源
  path?: string               // JSON路径 或 header名
  regex?: string              // 正则提取
  regexGroup?: number         // 正则分组索引
}

// 测试用例
export interface TestCase {
  id: string
  name: string
  description?: string

  // 关联请求
  requestId: string           // 关联SavedRequest ID

  // 请求前置处理
  preRequest?: {
    script?: string           // 前置脚本（预留）
    delay?: number            // 前置延迟(ms)
    variables?: Record<string, string>  // 变量设置
  }

  // 断言列表
  assertions: Assertion[]

  // 后置处理
  postRequest?: {
    script?: string           // 后置脚本（预留）
    extractVariables?: VariableExtraction[]
  }

  // 执行配置
  iterations?: number         // 执行次数（默认1）
  iterationDelay?: number     // 每次执行间隔(ms)
  timeout?: number            // 超时时间(ms)
  retryCount?: number         // 失败重试次数
  retryDelay?: number         // 重试间隔(ms)

  // 标记
  tags?: string[]             // 标签分类
  priority?: 'high' | 'medium' | 'low'
  enabled: boolean

  createdAt: number
  updatedAt: number
}

// 测试套件
export interface TestSuite {
  id: string
  name: string
  description?: string

  // 包含的测试用例ID
  testCaseIds: string[]

  // 执行顺序
  executionMode: 'sequential' | 'parallel'

  // 测试间间隔
  caseDelay?: number          // 用例间隔(ms)

  // 配置
  stopOnFailure?: boolean     // 遇到失败是否停止
  retryFailed?: boolean       // 失败重试

  createdAt: number
  updatedAt: number
}

// 断言结果
export interface AssertionResult {
  assertionId: string
  assertionType: AssertionType
  passed: boolean
  actualValue?: any
  expectedValue?: any
  error?: string
}

// 单个用例执行结果
export interface CaseResult {
  testCaseId: string
  testCaseName: string

  status: 'passed' | 'failed' | 'skipped'

  // 请求信息
  request: {
    method: string
    url: string
  }

  // 响应信息
  response?: {
    status: number
    statusText: string
    time: number
    size: number
    body?: string
  }
  error?: string

  // 断言结果
  assertionResults: AssertionResult[]

  // 提取的变量
  extractedVariables?: Record<string, string>

  // 时间
  startTime: number
  endTime: number
  responseTime: number

  // 重试次数
  retryCount?: number
}

// 测试报告
export interface TestReport {
  id: string
  suiteId?: string            // 所属套件ID（可选）
  suiteName?: string          // 套件名称

  startTime: number
  endTime: number
  duration: number            // 总耗时(ms)

  // 执行结果
  status: 'passed' | 'failed' | 'partial' | 'cancelled'

  // 统计
  total: number
  passed: number
  failed: number
  skipped: number

  // 用例结果详情
  caseResults: CaseResult[]

  // 执行环境
  environmentId?: string      // 执行时的环境ID
  environmentName?: string    // 环境名称

  createdAt: number
}

// 测试面板模式
export type TestPanelMode = 'stress' | 'testCase' | 'testSuite' | 'report' | null