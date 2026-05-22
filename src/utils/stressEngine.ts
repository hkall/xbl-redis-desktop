import { StressTestConfig, StressTestMetrics, StressTestResult, TimelinePoint, StressTestVariable } from '@/types/testTypes'
import { SavedRequest, KeyValue, HttpMethod } from '@/store/types'

// 变量池选择器
function selectVariableValue(variable: StressTestVariable, index: number): string {
  switch (variable.mode) {
    case 'sequence':
      return variable.values[index % variable.values.length]
    case 'round-robin':
      return variable.values[index % variable.values.length]
    case 'random':
      return variable.values[Math.floor(Math.random() * variable.values.length)]
    default:
      return variable.values[0] || ''
  }
}

// 替换变量（支持环境变量和压力测试变量）
export function replaceVars(
  text: string,
  envVars: Record<string, string>,
  testVars: StressTestVariable[],
  requestIndex: number
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    // 先查找压力测试变量
    const testVar = testVars.find(v => v.name === key)
    if (testVar && testVar.values.length > 0) {
      return selectVariableValue(testVar, requestIndex)
    }
    // 再查找环境变量
    return envVars[key] || `{{${key}}}`
  })
}

// 构建请求参数
export interface PreparedRequest {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string | FormData | URLSearchParams | Blob
  contentType?: string
}

// 准备单个请求
export function prepareRequest(
  savedRequest: SavedRequest,
  envVars: Record<string, string>,
  testVars: StressTestVariable[],
  requestIndex: number
): PreparedRequest {
  const replace = (text: string) => replaceVars(text, envVars, testVars, requestIndex)

  // 替换URL
  let url = replace(savedRequest.url)

  // 添加Query参数
  const enabledParams = savedRequest.params.filter(p => p.enabled && p.key)
  if (enabledParams.length > 0) {
    const urlObj = new URL(url)
    enabledParams.forEach(p => {
      urlObj.searchParams.append(p.key, replace(p.value))
    })
    url = urlObj.toString()
  }

  // 替换Headers
  const headers: Record<string, string> = {}
  savedRequest.headers.filter(h => h.enabled && h.key).forEach(h => {
    headers[h.key] = replace(h.value)
  })

  // 处理认证
  if (savedRequest.auth.type === 'bearer' && savedRequest.auth.token) {
    headers['Authorization'] = `Bearer ${replace(savedRequest.auth.token)}`
  } else if (savedRequest.auth.type === 'basic' && savedRequest.auth.username) {
    const credentials = btoa(`${replace(savedRequest.auth.username)}:${replace(savedRequest.auth.password || '')}`)
    headers['Authorization'] = `Basic ${credentials}`
  } else if (savedRequest.auth.type === 'api-key' && savedRequest.auth.apiKeyName && savedRequest.auth.apiKeyValue) {
    if (savedRequest.auth.apiKeyLocation === 'query') {
      const urlObj = new URL(url)
      urlObj.searchParams.append(replace(savedRequest.auth.apiKeyName), replace(savedRequest.auth.apiKeyValue))
      url = urlObj.toString()
    } else {
      headers[replace(savedRequest.auth.apiKeyName)] = replace(savedRequest.auth.apiKeyValue)
    }
  }

  // 构建请求体
  let body: string | FormData | URLSearchParams | Blob | undefined
  let contentType: string | undefined

  if (savedRequest.body.type !== 'none') {
    switch (savedRequest.body.type) {
      case 'json':
        body = replace(savedRequest.body.content)
        contentType = 'application/json'
        break
      case 'x-www-form-urlencoded':
        const urlParams = new URLSearchParams()
        ;(savedRequest.body.formData || []).filter(f => f.enabled && f.key && f.type === 'text').forEach(f => {
          urlParams.append(f.key, replace(f.value))
        })
        body = urlParams
        contentType = 'application/x-www-form-urlencoded'
        break
      case 'form-data':
        const formData = new FormData()
        ;(savedRequest.body.formData || []).filter(f => f.enabled && f.key).forEach(f => {
          if (f.type === 'file' && f.value) {
            const byteCharacters = atob(f.value)
            const byteArray = new Uint8Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteArray[i] = byteCharacters.charCodeAt(i)
            }
            const blob = new Blob([byteArray], { type: f.fileType || 'application/octet-stream' })
            formData.append(f.key, blob, f.fileName || 'file')
          } else if (f.type === 'text') {
            formData.append(f.key, replace(f.value))
          }
        })
        body = formData
        break
      case 'raw':
        body = replace(savedRequest.body.content)
        const rawType = savedRequest.body.rawType || 'text'
        contentType = rawType === 'text' ? 'text/plain'
          : rawType === 'xml' ? 'application/xml'
          : rawType === 'html' ? 'text/html'
          : rawType === 'javascript' ? 'application/javascript'
          : 'text/plain'
        break
      case 'binary':
        if (savedRequest.body.binaryFile?.data) {
          const byteCharacters = atob(savedRequest.body.binaryFile.data)
          const byteArray = new Uint8Array(byteCharacters.length)
          for (let i = 0; i < byteCharacters.length; i++) {
            byteArray[i] = byteCharacters.charCodeAt(i)
          }
          body = new Blob([byteArray], { type: savedRequest.body.binaryFile.type || 'application/octet-stream' })
        }
        break
    }
  }

  return { method: savedRequest.method, url, headers, body, contentType }
}

// 执行单个请求
export async function executeRequest(
  prepared: PreparedRequest,
  timeout: number,
  requestId: string
): Promise<StressTestResult> {
  const startTime = Date.now()

  try {
    // 使用 Electron API 发送请求
    if (window.electronAPI?.httpRequest) {
      let bodyForElectron: any = undefined
      let contentType = prepared.contentType

      if (prepared.body) {
        if (typeof prepared.body === 'string') {
          bodyForElectron = { type: 'text', content: prepared.body, contentType }
        } else if (prepared.body instanceof URLSearchParams) {
          bodyForElectron = { type: 'text', content: prepared.body.toString(), contentType: 'application/x-www-form-urlencoded' }
        } else if (prepared.body instanceof FormData) {
          // FormData 需要特殊处理，转换为 entries
          const entries: { key: string; value: string; type: string; fileName?: string }[] = []
          for (const [key, value] of prepared.body.entries()) {
            if (value instanceof Blob) {
              // 转换 Blob 为 base64
              const reader = new FileReader()
              reader.readAsDataURL(value)
              const base64 = await new Promise<string>((resolve) => {
                reader.onload = () => resolve((reader.result as string).split(',')[1])
              })
              entries.push({ key, value: base64, type: 'file', fileName: 'file' })
            } else {
              entries.push({ key, value: String(value), type: 'text' })
            }
          }
          bodyForElectron = { type: 'form-data', entries }
          contentType = undefined // 让 Electron 自动设置
        } else if (prepared.body instanceof Blob) {
          const reader = new FileReader()
          reader.readAsDataURL(prepared.body)
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => resolve((reader.result as string).split(',')[1])
          })
          bodyForElectron = { type: 'binary', content: base64, contentType: prepared.body.type }
        }
      }

      const headersArray = Object.entries(prepared.headers).map(([key, value]) => ({
        key,
        value,
        enabled: true
      }))
      if (contentType && prepared.body && !(prepared.body instanceof FormData)) {
        headersArray.push({ key: 'Content-Type', value: contentType, enabled: true })
      }

      const result = await window.electronAPI.httpRequest({
        method: prepared.method,
        url: prepared.url,
        headers: headersArray,
        body: bodyForElectron,
        timeout,
        requestId,
      })

      if (result.success && result.data) {
        return {
          requestId,
          success: true,
          status: result.data.status,
          statusText: result.data.statusText,
          responseTime: result.data.time,
          responseSize: result.data.size,
          timestamp: startTime,
        }
      } else {
        return {
          requestId,
          success: false,
          responseTime: Date.now() - startTime,
          error: result.error || 'Request failed',
          timestamp: startTime,
        }
      }
    } else {
      // 浏览器环境 fallback
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const headers: Record<string, string> = { ...prepared.headers }
      if (prepared.contentType && !(prepared.body instanceof FormData)) {
        headers['Content-Type'] = prepared.contentType
      }

      const options: RequestInit = {
        method: prepared.method,
        headers,
        signal: controller.signal,
      }

      if (['POST', 'PUT', 'PATCH'].includes(prepared.method) && prepared.body) {
        options.body = prepared.body
      }

      const response = await fetch(prepared.url, options)
      clearTimeout(timeoutId)

      const responseBody = await response.text()
      const responseTime = Date.now() - startTime

      return {
        requestId,
        success: response.status >= 200 && response.status < 400,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        responseSize: responseBody.length,
        timestamp: startTime,
      }
    }
  } catch (error: any) {
    return {
      requestId,
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message || 'Unknown error',
      timestamp: startTime,
    }
  }
}

// 计算统计指标
export function calculateMetrics(results: StressTestResult[], startTime: number): StressTestMetrics {
  const totalSent = results.length
  const totalSuccess = results.filter(r => r.success).length
  const totalFailed = totalSent - totalSuccess

  const responseTimes = results.map(r => r.responseTime).sort((a, b) => a - b)
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0
  const minResponseTime = responseTimes[0] || 0
  const maxResponseTime = responseTimes[responseTimes.length - 1] || 0

  // 计算百分位数
  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0
    const index = Math.ceil(arr.length * p) - 1
    return arr[Math.max(0, index)]
  }

  const p50ResponseTime = percentile(responseTimes, 0.5)
  const p90ResponseTime = percentile(responseTimes, 0.9)
  const p95ResponseTime = percentile(responseTimes, 0.95)
  const p99ResponseTime = percentile(responseTimes, 0.99)

  // 计算吞吐量
  const elapsedTime = Date.now() - startTime
  const requestsPerSecond = elapsedTime > 0 ? (totalSent / elapsedTime) * 1000 : 0
  const totalBytes = results.reduce((a, r) => a + (r.responseSize || 0), 0)
  const bytesPerSecond = elapsedTime > 0 ? (totalBytes / elapsedTime) * 1000 : 0

  // 计算错误率
  const errorRate = totalSent > 0 ? (totalFailed / totalSent) * 100 : 0

  // 错误类型统计
  const errorsByType: Record<string, number> = {}
  results.filter(r => !r.success).forEach(r => {
    const errorType = r.error || (r.status ? `HTTP ${r.status}` : 'Unknown')
    errorsByType[errorType] = (errorsByType[errorType] || 0) + 1
  })

  // 状态码分布
  const statusDistribution: Record<number, number> = {}
  results.forEach(r => {
    if (r.status) {
      statusDistribution[r.status] = (statusDistribution[r.status] || 0) + 1
    } else {
      statusDistribution[0] = (statusDistribution[0] || 0) + 1 // 无状态码（网络错误等）
    }
  })

  return {
    totalSent,
    totalSuccess,
    totalFailed,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p50ResponseTime,
    p90ResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    requestsPerSecond,
    bytesPerSecond,
    totalBytes,
    errorRate,
    errorsByType,
    statusDistribution,
    timeline: [],
    startTime,
    elapsedTime,
  }
}

// 压力测试引擎
export class StressTestEngine {
  private config: StressTestConfig
  private savedRequest: SavedRequest
  private envVars: Record<string, string>
  private abortController: AbortController | null = null
  private results: StressTestResult[] = []
  private startTime: number = 0
  private requestIndex: number = 0
  private running: boolean = false
  private totalRequests: number = 100
  private onMetricsUpdate: (metrics: StressTestMetrics) => void

  constructor(
    config: StressTestConfig,
    savedRequest: SavedRequest,
    envVars: Record<string, string>,
    onMetricsUpdate: (metrics: StressTestMetrics) => void
  ) {
    this.config = config
    this.savedRequest = savedRequest
    this.envVars = envVars
    this.onMetricsUpdate = onMetricsUpdate
    this.totalRequests = config.totalRequests || 100
  }

  // 获取下一个请求索引（原子操作）
  private getNextIndex(): number | null {
    if (this.requestIndex >= this.totalRequests) {
      return null
    }
    const index = ++this.requestIndex
    if (index > this.totalRequests) {
      return null
    }
    return index
  }

  // 启动测试
  async start(): Promise<StressTestMetrics> {
    this.running = true
    this.results = []
    this.startTime = Date.now()
    this.requestIndex = 0
    this.abortController = new AbortController()

    // 使用默认值处理空值
    const concurrency = Math.min(this.config.concurrency || 10, 100)
    const totalRequests = this.config.totalRequests || 100
    const rampUpMs = (this.config.rampUp || 0) * 1000
    const thinkTimeMs = this.config.thinkTime || 0
    const timeout = this.config.timeout || 30000
    const testVars = this.config.variables || []

    // 计算爬升间隔
    const rampUpInterval = rampUpMs > 0 ? rampUpMs / concurrency : 0

    // 并发队列
    const workers: Promise<void>[] = []

    // 创建并发工作器
    for (let workerId = 0; workerId < concurrency; workerId++) {
      const workerPromise = async () => {
        // 爬升延迟启动
        if (rampUpInterval > 0) {
          await this.delay(workerId * rampUpInterval)
        }

        while (this.running) {
          if (this.abortController?.signal.aborted) break

          // 获取下一个请求索引
          const index = this.getNextIndex()
          if (index === null) break

          const requestId = crypto.randomUUID()

          // 准备请求
          const prepared = prepareRequest(this.savedRequest, this.envVars, testVars, index)

          // 执行请求
          const result = await executeRequest(prepared, timeout, requestId)
          this.results.push(result)

          // 更新指标
          this.onMetricsUpdate(calculateMetrics(this.results, this.startTime))

          // 请求间隔
          if (thinkTimeMs > 0) {
            await this.delay(thinkTimeMs)
          }
        }
      }
      workers.push(workerPromise())
    }

    // 等待所有工作器完成
    await Promise.allSettled(workers)

    // 最终指标
    const finalMetrics = calculateMetrics(this.results, this.startTime)
    finalMetrics.timeline = this.generateTimeline()

    this.running = false
    return finalMetrics
  }

  // 停止测试
  stop() {
    this.running = false
    if (this.abortController) {
      this.abortController.abort()
    }
  }

  // 是否正在运行
  isRunning(): boolean {
    return this.running
  }

  // 获取当前结果
  getResults(): StressTestResult[] {
    return this.results
  }

  // 延迟函数
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 生成时间轴数据
  private generateTimeline(): TimelinePoint[] {
    const timeline: TimelinePoint[] = []
    const bucketSize = 1000 // 1秒一个桶
    const buckets: Map<number, { success: number; fail: number; times: number[] }> = new Map()

    this.results.forEach(result => {
      const bucket = Math.floor((result.timestamp - this.startTime) / bucketSize)
      const existing = buckets.get(bucket) || { success: 0, fail: 0, times: [] }
      if (result.success) {
        existing.success++
      } else {
        existing.fail++
      }
      existing.times.push(result.responseTime)
      buckets.set(bucket, existing)
    })

    buckets.forEach((data, bucket) => {
      timeline.push({
        timestamp: this.startTime + bucket * bucketSize,
        rps: data.success + data.fail,
        avgTime: data.times.length > 0 ? data.times.reduce((a, b) => a + b, 0) / data.times.length : 0,
        successCount: data.success,
        failCount: data.fail,
      })
    })

    return timeline.sort((a, b) => a.timestamp - b.timestamp)
  }
}