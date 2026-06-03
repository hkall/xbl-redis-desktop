import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Send, Save, X, ChevronDown, Plus, Trash2,
  FormInput, FileCode, XCircle, Clock, HardDrive, Copy, Check,
  Upload, FileText, Braces, Pencil, Terminal, ChevronLeft, ChevronRight, MapPin, Paperclip
} from 'lucide-react'
import { useApiStore } from '@/store/apiStore'
import { KeyValue, HttpMethod, RequestBody, AuthConfig, RequestFolder, isFolder, SavedRequest, FormField, TestPanelMode } from '@/store/types'
import { useToast } from '@/components/common/Toast'
import { generateCode, CodeTarget } from '@/utils/codeGenerator'
import { useTranslation } from '@/store/i18nStore'
import StressTestPanel from './stress/StressTestPanel'
import TestCasePanel from './test/TestCasePanel'
import TestSuitePanel from './test/TestSuitePanel'
import TestReportPanel from './test/TestReportPanel'

// HTTP方法选项
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

// 方法颜色
const METHOD_COLORS: Record<HttpMethod, { bg: string; text: string }> = {
  GET: { bg: 'bg-emerald-500 hover:bg-emerald-600', text: 'text-emerald-500' },
  POST: { bg: 'bg-blue-500 hover:bg-blue-600', text: 'text-blue-500' },
  PUT: { bg: 'bg-amber-500 hover:bg-amber-600', text: 'text-amber-500' },
  DELETE: { bg: 'bg-red-500 hover:bg-red-600', text: 'text-red-500' },
  PATCH: { bg: 'bg-purple-500 hover:bg-purple-600', text: 'text-purple-500' },
  HEAD: { bg: 'bg-gray-500 hover:bg-gray-600', text: 'text-gray-500' },
  OPTIONS: { bg: 'bg-gray-500 hover:bg-gray-600', text: 'text-gray-500' },
}

// Tab方法颜色（浅色背景）
const METHOD_TAB_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400',
  POST: 'text-blue-600 dark:text-blue-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  DELETE: 'text-red-600 dark:text-red-400',
  PATCH: 'text-purple-600 dark:text-purple-400',
  HEAD: 'text-gray-600 dark:text-gray-400',
  OPTIONS: 'text-gray-600 dark:text-gray-400',
}

// 状态码颜色
const getStatusColor = (status: number) => {
  if (status >= 200 && status < 300) return 'text-emerald-500'
  if (status >= 300 && status < 400) return 'text-blue-500'
  if (status >= 400 && status < 500) return 'text-amber-500'
  return 'text-red-500'
}

const getStatusBg = (status: number) => {
  if (status >= 200 && status < 300) return 'bg-emerald-500/10'
  if (status >= 300 && status < 400) return 'bg-blue-500/10'
  if (status >= 400 && status < 500) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

// 方法背景色（用于显示）
const getMethodColor = (method: string) => {
  const colors: Record<string, string> = {
    GET: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    POST: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PUT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    HEAD: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    OPTIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  return colors[method] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
}

// Resizable Divider Component (Horizontal - for width)
function ResizableDivider({
  onResize,
}: {
  onResize: (delta: number) => void
}) {
  const isDragging = useRef(false)
  const startX = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      startX.current = e.clientX
      onResize(-delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return (
    <div
      className="w-1.5 flex-shrink-0 bg-transparent hover:bg-blue-500/30 dark:hover:bg-blue-400/30 cursor-col-resize transition-colors group flex items-center justify-center relative"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-2 w-0.5 bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-400 rounded-full transition-colors" />
    </div>
  )
}

// Vertical Resizable Divider (for height)
function VerticalResizableDivider({
  onResize,
}: {
  onResize: (delta: number) => void
}) {
  const isDragging = useRef(false)
  const startY = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // 阻止事件冒泡
    isDragging.current = true
    startY.current = e.clientY
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      // 向上拖拽：delta > 0（高度增加）
      // 向下拖拽：delta < 0（高度减小）
      const delta = startY.current - e.clientY
      startY.current = e.clientY
      onResize(delta)
    }

    const handleMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  return (
    <div
      className="h-2 flex-shrink-0 bg-transparent hover:bg-blue-500/50 dark:hover:bg-blue-400/50 cursor-row-resize transition-colors flex items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      <div className="w-full h-0.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
    </div>
  )
}

export default function ApiWorkspace() {
  const { showToast } = useToast()
  const { t } = useTranslation()
  const {
    currentRequest,
    originalRequest,
    currentResponse,
    currentError,
    loading,
    updateCurrentRequest,
    setCurrentResponse,
    setCurrentError,
    setLoading,
    saveRequest,
    updateSavedRequest,
    addHistory,
    getActiveProject,
    findRequestById,
    setCurrentRequest,
    // Tab管理
    openTabs,
    activeTabId,
    closeTab,
    closeAllTabs,
    switchTab,
    // 定位请求
    setLocateRequestId,
    // 测试面板
    testPanelMode,
    setTestPanelMode,
  } = useApiStore()

  // Get active project and its data
  const activeProject = getActiveProject()
  const requestFolders = activeProject?.requestFolders || []
  const rootRequests = activeProject?.rootRequests || []
  const environments = activeProject?.environments || []
  const activeEnvId = activeProject?.activeEnvId || null

  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params')
  const [showMethodDropdown, setShowMethodDropdown] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveFolderId, setSaveFolderId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [codeTarget, setCodeTarget] = useState<CodeTarget>('curl')
  const [codeCopied, setCodeCopied] = useState(false)
  const [showTimeoutDropdown, setShowTimeoutDropdown] = useState(false)
  const [editingRequestName, setEditingRequestName] = useState(false)
  const [requestNameInput, setRequestNameInput] = useState('')
  const [sentRequest, setSentRequest] = useState<{
    method: string
    url: string
    headers: Record<string, string>
    body?: string
  } | null>(null)

  // 拖拽调整宽度
  const [requestPanelPercent, setRequestPanelPercent] = useState(55) // 默认 55%
  // 拖拽调整实际发送请求区域高度
  const [sentRequestHeight, setSentRequestHeight] = useState(200) // 默认 200px
  const [sentRequestOpen, setSentRequestOpen] = useState(true) // 默认展开
  const containerRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentRequestIdRef = useRef<string | null>(null)

  const handlePanelResize = useCallback((delta: number) => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const deltaPercent = (delta / containerWidth) * 100
    setRequestPanelPercent(prev => {
      const newPercent = prev + deltaPercent
      return Math.max(25, Math.min(75, newPercent)) // 限制 25% - 75%
    })
  }, [])

  const handleSentRequestResize = useCallback((delta: number) => {
    setSentRequestHeight(prev => {
      const newHeight = prev + delta
      return Math.max(100, Math.min(500, newHeight)) // 限制 100px - 500px
    })
  }, [])

  // 获取当前环境的变量列表
  const activeEnv = environments.find(e => e.id === activeEnvId)
  const activeVariables = activeEnv?.variables.filter(v => v.enabled) || []

  // 计算是否有未保存的修改
  const hasUnsavedChanges = React.useMemo(() => {
    if (!currentRequest || !originalRequest) return false
    // 比较 method, url, headers, params, body, auth
    const fieldsToCompare = ['method', 'url', 'headers', 'params', 'body', 'auth'] as const
    for (const field of fieldsToCompare) {
      const current = JSON.stringify(currentRequest[field])
      const original = JSON.stringify(originalRequest[field])
      if (current !== original) return true
    }
    return false
  }, [currentRequest, originalRequest])

  // 检查同一目录下是否存在同名请求
  const checkNameExists = (name: string, folderId: string | null, excludeId?: string): boolean => {
    const checkInFolder = (folders: typeof requestFolders, requests: typeof rootRequests): boolean => {
      // 检查根目录请求
      if (folderId === null) {
        for (const r of requests) {
          if (r.id !== excludeId && r.name === name) return true
        }
      }
      // 检查文件夹中的请求
      for (const f of folders) {
        if (folderId === null || f.id === folderId) {
          for (const c of f.children) {
            if ('method' in c && c.id !== excludeId && c.name === name) return true
          }
        }
        // 递归检查子文件夹
        const childFolders = f.children.filter(isFolder) as RequestFolder[]
        if (childFolders.length > 0) {
          if (checkInFolder(childFolders, [])) return true
        }
      }
      return false
    }
    return checkInFolder(requestFolders, rootRequests)
  }

  // 取消请求
  const handleCancel = () => {
    // Electron 环境
    if (window.electronAPI?.httpCancel && currentRequestIdRef.current) {
      window.electronAPI.httpCancel(currentRequestIdRef.current)
      currentRequestIdRef.current = null
    }
    // 浏览器环境
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setCurrentError(t('api.requestCancelled'))
  }

  // 发送请求
  const handleSend = async () => {
    if (!currentRequest?.url) {
      showToast(t('api.pleaseEnterUrl'), 'error')
      return
    }

    // 创建 AbortController 用于取消请求
    const controller = new AbortController()
    abortControllerRef.current = controller

    // 获取当前项目的环境变量（确保是最新的）
    const state = useApiStore.getState()
    const project = state.getActiveProject()
    const activeEnv = project?.environments.find(e => e.id === project.activeEnvId)
    const currentVars: Record<string, string> = {}
    activeEnv?.variables.filter(v => v.enabled).forEach(v => {
      currentVars[v.key] = v.value
    })

    // 替换变量
    const replaceVars = (text: string) => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => currentVars[key] || `{{${key}}}`)
    }

    setLoading(true)
    setCurrentResponse(null)
    setCurrentError(null)
    setSentRequest(null) // 重置之前的请求信息

    const startTime = Date.now()

    try {
      // 替换URL中的变量
      let finalUrl = replaceVars(currentRequest.url)

      // 添加Query参数
      const enabledParams = currentRequest.params.filter(p => p.enabled && p.key)
      if (enabledParams.length > 0) {
        const urlObj = new URL(finalUrl)
        enabledParams.forEach(p => {
          urlObj.searchParams.append(p.key, replaceVars(p.value))
        })
        finalUrl = urlObj.toString()
      }

      // 替换Headers中的变量
      const finalHeaders = currentRequest.headers.filter(h => h.enabled && h.key).map(h => ({
        key: h.key,
        value: replaceVars(h.value),
        enabled: true,
      }))

      // 处理认证
      const authHeaders: { key: string; value: string; enabled: boolean }[] = []
      if (currentRequest.auth.type === 'bearer' && currentRequest.auth.token) {
        authHeaders.push({ key: 'Authorization', value: `Bearer ${replaceVars(currentRequest.auth.token)}`, enabled: true })
      } else if (currentRequest.auth.type === 'basic' && currentRequest.auth.username) {
        const credentials = btoa(`${replaceVars(currentRequest.auth.username)}:${replaceVars(currentRequest.auth.password || '')}`)
        authHeaders.push({ key: 'Authorization', value: `Basic ${credentials}`, enabled: true })
      } else if (currentRequest.auth.type === 'api-key' && currentRequest.auth.apiKeyName && currentRequest.auth.apiKeyValue) {
        if (currentRequest.auth.apiKeyLocation === 'query') {
          // 添加到URL查询参数
          const urlObj = new URL(finalUrl)
          urlObj.searchParams.append(replaceVars(currentRequest.auth.apiKeyName), replaceVars(currentRequest.auth.apiKeyValue))
          finalUrl = urlObj.toString()
        } else {
          authHeaders.push({ key: replaceVars(currentRequest.auth.apiKeyName), value: replaceVars(currentRequest.auth.apiKeyValue), enabled: true })
        }
      }

      const allHeaders = [...finalHeaders, ...authHeaders]

      // 构建请求体
      let requestBody: string | FormData | URLSearchParams | Blob | undefined
      let contentType: string | undefined

      if (currentRequest.body.type !== 'none') {
        switch (currentRequest.body.type) {
          case 'json':
            requestBody = replaceVars(currentRequest.body.content)
            contentType = 'application/json'
            break
          case 'x-www-form-urlencoded':
            const urlParams = new URLSearchParams()
            ;(currentRequest.body.formData || []).filter(f => f.enabled && f.key && f.type === 'text').forEach(f => {
              urlParams.append(f.key, replaceVars(f.value))
            })
            requestBody = urlParams
            contentType = 'application/x-www-form-urlencoded'
            break
          case 'form-data':
            const formData = new FormData()
            ;(currentRequest.body.formData || []).filter(f => f.enabled && f.key).forEach(f => {
              if (f.type === 'file' && f.value) {
                // 从base64恢复文件
                const byteCharacters = atob(f.value)
                const byteNumbers = new Array(byteCharacters.length)
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                const blob = new Blob([byteArray], { type: f.fileType || 'application/octet-stream' })
                formData.append(f.key, blob, f.fileName || 'file')
              } else if (f.type === 'text') {
                formData.append(f.key, replaceVars(f.value))
              }
            })
            requestBody = formData
            // 不设置Content-Type，让浏览器自动设置multipart/form-data边界
            break
          case 'raw':
            requestBody = replaceVars(currentRequest.body.content)
            const rawType = currentRequest.body.rawType || 'text'
            contentType = rawType === 'text' ? 'text/plain'
              : rawType === 'xml' ? 'application/xml'
              : rawType === 'html' ? 'text/html'
              : rawType === 'javascript' ? 'application/javascript'
              : 'text/plain'
            break
          case 'binary':
            if (currentRequest.body.binaryFile?.data) {
              const byteCharacters = atob(currentRequest.body.binaryFile.data)
              const byteNumbers = new Array(byteCharacters.length)
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i)
              }
              const byteArray = new Uint8Array(byteNumbers)
              requestBody = new Blob([byteArray], { type: currentRequest.body.binaryFile.type || 'application/octet-stream' })
              contentType = currentRequest.body.binaryFile.type || 'application/octet-stream'
            }
            break
        }
      }

      // 设置发送的请求信息（无论成功失败都显示）
      const requestHeaders: Record<string, string> = {}
      allHeaders.forEach(h => { requestHeaders[h.key] = h.value })
      if (contentType && !(requestBody instanceof FormData)) {
        requestHeaders['Content-Type'] = contentType
      }

      let requestBodyPreview: string | undefined
      if (typeof requestBody === 'string') {
        requestBodyPreview = requestBody
      } else if (requestBody instanceof URLSearchParams) {
        requestBodyPreview = requestBody.toString()
      } else if (requestBody instanceof FormData) {
        requestBodyPreview = '[FormData]'
      } else if (requestBody instanceof Blob) {
        requestBodyPreview = `[Binary: ${(requestBody as Blob).size} bytes]`
      }

      setSentRequest({
        method: currentRequest.method,
        url: finalUrl,
        headers: requestHeaders,
        body: requestBodyPreview,
      })

      let result

      if (window.electronAPI?.httpRequest) {
        // Electron环境 - 生成 requestId 用于取消请求
        const requestId = crypto.randomUUID()
        currentRequestIdRef.current = requestId

        // 需要将FormData转换为可序列化格式
        let bodyForElectron: any = undefined
        if (requestBody) {
          if (typeof requestBody === 'string') {
            bodyForElectron = { type: 'text', content: requestBody, contentType }
          } else if (requestBody instanceof URLSearchParams) {
            bodyForElectron = { type: 'text', content: requestBody.toString(), contentType }
          } else if (requestBody instanceof FormData) {
            // 将FormData转为数组
            const entries: { key: string; value: string; type: string; fileName?: string }[] = []
            requestBody.forEach((value, key) => {
              if (value instanceof File) {
                // 需要异步读取文件，这里简化处理
                entries.push({ key, value: '', type: 'file', fileName: value.name })
              } else {
                entries.push({ key, value, type: 'text' })
              }
            })
            bodyForElectron = { type: 'form-data', entries }
          } else if (requestBody instanceof Blob) {
            // Blob转base64
            const reader = new FileReader()
            bodyForElectron = await new Promise(resolve => {
              reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1]
                resolve({ type: 'binary', content: base64, contentType })
              }
              reader.readAsDataURL(requestBody)
            })
          }
        }

        result = await window.electronAPI.httpRequest({
          method: currentRequest.method,
          url: finalUrl,
          headers: [...allHeaders, ...(contentType ? [{ key: 'Content-Type', value: contentType, enabled: true }] : [])],
          body: bodyForElectron,
          timeout: currentRequest.timeout || 30000,
          requestId,
        } as any)
      } else {
        // 浏览器环境
        const headers: Record<string, string> = {}
        allHeaders.forEach(h => { headers[h.key] = h.value })
        // 不要手动设置Content-Type for FormData，让浏览器自动处理boundary
        if (contentType && !(requestBody instanceof FormData)) {
          headers['Content-Type'] = contentType
        }

        const requestTimeout = currentRequest.timeout || 30000
        const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

        const fetchOptions: RequestInit = {
          method: currentRequest.method,
          headers,
          signal: controller.signal,
        }

        if (['POST', 'PUT', 'PATCH'].includes(currentRequest.method) && requestBody) {
          fetchOptions.body = requestBody
        }

        const response = await fetch(finalUrl, fetchOptions)
        clearTimeout(timeoutId)
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((v, k) => { responseHeaders[k] = v })
        const responseBody = await response.text()

        result = {
          success: true,
          data: {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            body: responseBody,
            time: Date.now() - startTime,
            size: responseBody.length,
          },
        }
      }

      if (result?.success) {
        setCurrentResponse(result.data)
        addHistory({
          request: {
            method: currentRequest.method,
            url: currentRequest.url,
            headers: currentRequest.headers,
            params: currentRequest.params,
            body: currentRequest.body,
            auth: currentRequest.auth,
          },
          response: result.data,
        })
      } else {
        setCurrentError(result?.error || t('api.requestFailed'))
        addHistory({
          request: {
            method: currentRequest.method,
            url: currentRequest.url,
            headers: currentRequest.headers,
            params: currentRequest.params,
            body: currentRequest.body,
            auth: currentRequest.auth,
          },
          error: result?.error || t('api.requestFailed'),
        })
      }
    } catch (error) {
      // 处理取消请求
      if (error instanceof Error && error.name === 'AbortError') {
        setCurrentError(t('api.requestCancelled'))
      } else {
        const errorMsg = error instanceof Error ? error.message : t('api.requestFailed')
        setCurrentError(errorMsg)
        addHistory({
          request: {
            method: currentRequest.method,
            url: currentRequest.url,
            headers: currentRequest.headers,
            params: currentRequest.params,
            body: currentRequest.body,
            auth: currentRequest.auth,
          },
          error: errorMsg,
        })
      }
    } finally {
      setLoading(false)
      abortControllerRef.current = null
      currentRequestIdRef.current = null

      // 无论请求成功失败，都显示请求信息
      try {
        // 替换URL中的变量
        let finalUrl = replaceVars(currentRequest.url)

        // 添加Query参数
        const enabledParams = currentRequest.params.filter(p => p.enabled && p.key)
        if (enabledParams.length > 0) {
          try {
            const urlObj = new URL(finalUrl)
            enabledParams.forEach(p => {
              urlObj.searchParams.append(p.key, replaceVars(p.value))
            })
            finalUrl = urlObj.toString()
          } catch {
            // URL无效，跳过参数添加
          }
        }

        // 替换Headers中的变量
        const finalHeaders = currentRequest.headers.filter(h => h.enabled && h.key).map(h => ({
          key: h.key,
          value: replaceVars(h.value),
        }))

        // 处理认证
        const authHeaders: { key: string; value: string }[] = []
        if (currentRequest.auth.type === 'bearer' && currentRequest.auth.token) {
          authHeaders.push({ key: 'Authorization', value: `Bearer ${replaceVars(currentRequest.auth.token)}` })
        } else if (currentRequest.auth.type === 'basic' && currentRequest.auth.username) {
          const credentials = btoa(`${replaceVars(currentRequest.auth.username)}:${replaceVars(currentRequest.auth.password || '')}`)
          authHeaders.push({ key: 'Authorization', value: `Basic ${credentials}` })
        } else if (currentRequest.auth.type === 'api-key' && currentRequest.auth.apiKeyName && currentRequest.auth.apiKeyValue) {
          if (currentRequest.auth.apiKeyLocation !== 'query') {
            authHeaders.push({ key: replaceVars(currentRequest.auth.apiKeyName), value: replaceVars(currentRequest.auth.apiKeyValue) })
          }
        }

        const allHeaders = [...finalHeaders, ...authHeaders]
        const headersObj: Record<string, string> = {}
        allHeaders.forEach(h => { headersObj[h.key] = h.value })

        // 添加Content-Type
        if (currentRequest.body.type !== 'none') {
          const contentTypes: Record<string, string> = {
            'json': 'application/json',
            'x-www-form-urlencoded': 'application/x-www-form-urlencoded',
            'raw': 'text/plain',
          }
          if (contentTypes[currentRequest.body.type]) {
            headersObj['Content-Type'] = contentTypes[currentRequest.body.type]
          }
        }

        // Body预览
        let bodyPreview: string | undefined
        if (currentRequest.body.type === 'json' && currentRequest.body.content) {
          bodyPreview = replaceVars(currentRequest.body.content)
        } else if (currentRequest.body.type === 'x-www-form-urlencoded') {
          const params = (currentRequest.body.formData || [])
            .filter(f => f.enabled && f.key && f.type === 'text')
            .map(f => `${f.key}=${replaceVars(f.value)}`)
            .join('&')
          bodyPreview = params || undefined
        } else if (currentRequest.body.type === 'form-data') {
          const hasFiles = (currentRequest.body.formData || []).some(f => f.type === 'file')
          bodyPreview = hasFiles ? '[FormData with files]' : '[FormData]'
        }

        setSentRequest({
          method: currentRequest.method,
          url: finalUrl,
          headers: headersObj,
          body: bodyPreview,
        })
      } catch {
        // 忽略设置请求信息时的错误
      }
    }
  }

  // 保存请求
  const handleSave = () => {
    if (!saveName.trim()) {
      showToast(t('api.pleaseEnterName'), 'error')
      return
    }

    // 检查名称唯一性
    if (checkNameExists(saveName.trim(), saveFolderId, currentRequest?.id)) {
      showToast(t('api.nameAlreadyExists'), 'error')
      return
    }

    // 如果当前请求有ID且存在，则更新
    if (currentRequest?.id) {
      const existingRequest = findRequestById(currentRequest.id)
      if (existingRequest) {
        updateSavedRequest(currentRequest.id, {
          name: saveName.trim(),
          method: currentRequest.method,
          url: currentRequest.url,
          headers: currentRequest.headers,
          params: currentRequest.params,
          body: currentRequest.body,
          auth: currentRequest.auth,
        })
        setShowSaveModal(false)
        setSaveName('')
        setSaveFolderId(null)
        return
      }
    }

    // 否则创建新请求
    saveRequest({
      name: saveName,
      method: currentRequest?.method || 'GET',
      url: currentRequest?.url || '',
      headers: currentRequest?.headers || [],
      params: currentRequest?.params || [],
      body: currentRequest?.body || { type: 'none', content: '', formData: [] },
      auth: currentRequest?.auth || { type: 'none' },
    }, saveFolderId)
    setShowSaveModal(false)
    setSaveName('')
    setSaveFolderId(null)
  }

  // 获取所有文件夹选项（扁平化）
  const getFolderOptions = (folders: RequestFolder[], depth = 0): { id: string | null; name: string; depth: number }[] => {
    const result: { id: string | null; name: string; depth: number }[] = [
      { id: null, name: t('api.rootDirectory'), depth: 0 }
    ]
    for (const f of folders) {
      result.push({ id: f.id, name: f.name, depth: depth + 1 })
      const childFolders = f.children.filter(isFolder) as RequestFolder[]
      if (childFolders.length > 0) {
        result.push(...getFolderOptions(childFolders, depth + 1))
      }
    }
    return result
  }

  const folderOptions = getFolderOptions(requestFolders)

  // 复制响应
  const handleCopyResponse = () => {
    if (currentResponse?.body) {
      navigator.clipboard.writeText(currentResponse.body)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        handleSend()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentRequest])

  // 获取tab对应的请求信息
  const getTabRequest = (tabId: string): SavedRequest | null => {
    return findRequestById(tabId)
  }

  // Tab栏组件
  const RequestTabsBar = () => {
    const tabsContainerRef = useRef<HTMLDivElement>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    // 检查滚动状态
    const checkScroll = useCallback(() => {
      if (!tabsContainerRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = tabsContainerRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }, [])

    useEffect(() => {
      checkScroll()
      window.addEventListener('resize', checkScroll)
      return () => window.removeEventListener('resize', checkScroll)
    }, [checkScroll, openTabs])

    // 滚动处理
    const scroll = (direction: 'left' | 'right') => {
      if (!tabsContainerRef.current) return
      const scrollAmount = 150
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkScroll, 100)
    }

    // 确保当前激活的tab可见
    useEffect(() => {
      if (!tabsContainerRef.current || !activeTabId) return
      const activeTab = tabsContainerRef.current.querySelector(`[data-tab-id="${activeTabId}"]`)
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
      }
    }, [activeTabId])

    return (
      <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 relative">
        <div className="flex items-center h-9">
          {/* 左滚动按钮 */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-gray-100 dark:from-gray-800 to-transparent z-10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}

          {/* Tab列表 */}
          <div
            ref={tabsContainerRef}
            onScroll={checkScroll}
            className="flex items-center h-full overflow-x-auto scrollbar-hide flex-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            {/* 临时请求Tab */}
            {isTempRequest && currentRequest && (
              <div
                key={currentRequest.id}
                data-tab-id={currentRequest.id}
                className="group flex items-center h-full px-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-colors flex-shrink-0 select-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                title={currentRequest.url || t('api.historyRequest')}
              >
                {/* 方法标签 */}
                <span className={`text-[11px] font-semibold mr-1.5 ${METHOD_TAB_COLORS[currentRequest.method]}`}>
                  {currentRequest.method}
                </span>

                {/* 名称 - 显示URL简短版本 */}
                <span className="text-[11px] truncate max-w-[100px]">
                  {currentRequest.url ? currentRequest.url.replace(/^https?:\/\//, '').replace(/^www\./, '').slice(0, 30) : t('api.history')}
                </span>

                {/* 关闭按钮 */}
                <button
                  onClick={() => setCurrentRequest(null)}
                  className="ml-1.5 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title={t('common.close')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {openTabs.map((tabId) => {
              const tabRequest = getTabRequest(tabId)
              if (!tabRequest) return null

              const isActive = activeTabId === tabId

              return (
                <div
                  key={tabId}
                  data-tab-id={tabId}
                  className={`group flex items-center h-full px-2 border-r border-gray-200 dark:border-gray-700 cursor-pointer transition-colors flex-shrink-0 select-none ${
                    isActive
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800/50'
                  }`}
                  onClick={() => switchTab(tabId)}
                  title={tabRequest.name || t('api.unnamed')}
                >
                  {/* 未保存标记 */}
                  {isActive && hasUnsavedChanges && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" title={t('api.unsavedChanges')} />
                  )}

                  {/* 方法标签 */}
                  <span className={`text-[11px] font-semibold mr-1.5 ${METHOD_TAB_COLORS[tabRequest.method]}`}>
                    {tabRequest.method}
                  </span>

                  {/* 名称 */}
                  <span className="text-[11px] truncate max-w-[100px]">
                    {tabRequest.name || t('api.unnamed')}
                  </span>

                  {/* {t('common.close')}按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tabId)
                    }}
                    className="ml-1.5 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title={t('common.close')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )
            })}
          </div>

          {/* 右滚动按钮 */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-10 top-0 bottom-0 w-6 bg-gradient-to-l from-gray-100 dark:from-gray-800 to-transparent z-10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}

          {/* 新建Tab按钮 */}
          <button
            onClick={() => {
              const newRequest: Omit<SavedRequest, 'id' | 'createdAt' | 'updatedAt'> = {
                name: t('api.newRequest'),
                method: 'GET',
                url: '',
                headers: [],
                params: [],
                body: { type: 'none', content: '', formData: [] },
                auth: { type: 'none' },
              }
              const result = saveRequest(newRequest, null)
              if (!result.success && result.limitReached) {
                showToast(t('api.tabLimitReached'), 'error')
              }
            }}
            className="flex-shrink-0 px-1.5 h-full text-gray-400 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors"
            title={t('api.newRequest')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {/* 关闭所有按钮 */}
          {openTabs.length > 0 && (
            <button
              onClick={() => closeAllTabs()}
              className="flex-shrink-0 px-1.5 h-full text-gray-400 hover:text-red-500 hover:bg-gray-200 dark:hover:bg-gray-800/50 transition-colors"
              title={t('api.closeAllTabs')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // 显示空状态或Tab栏+内容
  // 如果有临时请求（currentRequest存在但不在openTabs中），也显示编辑区
  const isTempRequest = currentRequest && currentRequest.id.startsWith('temp-')

  if (openTabs.length === 0 && !isTempRequest) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-800">
        <RequestTabsBar />
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <Send className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>{t('api.clickToAddRequest')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!currentRequest) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
        <div className="text-center">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>{t('api.selectOrCreateRequest')}</p>
        </div>
      </div>
    )
  }

  // 测试面板渲染
  if (testPanelMode) {
    switch (testPanelMode) {
      case 'stress':
        return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <StressTestPanel />
          </div>
        )
      case 'testCase':
        return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <TestCasePanel />
          </div>
        )
      case 'testSuite':
        return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <TestSuitePanel />
          </div>
        )
      case 'report':
        return (
          <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <TestReportPanel />
          </div>
        )
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Request Tabs Bar */}
      <RequestTabsBar />

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex min-h-0">
        {/* Left: Request Panel */}
        <div
          className="flex flex-col min-w-0 border-r border-gray-200 dark:border-gray-700"
          style={{ width: `${requestPanelPercent}%` }}
        >
          {/* Request Name */}
          <div className="flex-shrink-0 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 select-none">
            {editingRequestName ? (
              <input
                type="text"
                value={requestNameInput}
                onChange={(e) => setRequestNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const trimmedName = requestNameInput.trim()
                    if (trimmedName) {
                      updateCurrentRequest({ name: trimmedName })
                      // 如果是已保存的请求，同时更新保存的请求
                      if (currentRequest?.id) {
                        updateSavedRequest(currentRequest.id, { name: trimmedName })
                      }
                    }
                    setEditingRequestName(false)
                  }
                  if (e.key === 'Escape') {
                    setEditingRequestName(false)
                  }
                }}
                onBlur={() => {
                  const trimmedName = requestNameInput.trim()
                  if (trimmedName) {
                    updateCurrentRequest({ name: trimmedName })
                    // 如果是已保存的请求，同时更新保存的请求
                    if (currentRequest?.id) {
                      updateSavedRequest(currentRequest.id, { name: trimmedName })
                    }
                  }
                  setEditingRequestName(false)
                }}
                className="w-full px-2 py-1 text-[13px] font-medium bg-gray-100 dark:bg-gray-800 border border-blue-500 rounded outline-none transition-all duration-200"
                autoFocus
              />
            ) : (
              <div
                className="flex items-center gap-1.5 cursor-pointer group py-0.5"
                onClick={() => {
                  setRequestNameInput(currentRequest?.name || '')
                  setEditingRequestName(true)
                }}
              >
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate flex-1">
                  {currentRequest?.name || t('api.unnamedRequest')}
                </span>
                {currentRequest?.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setLocateRequestId(currentRequest.id)
                    }}
                    className="p-0.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-opacity opacity-0 group-hover:opacity-100"
                    title={t('api.locateInSidebar')}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                )}
                <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>

          {/* Request Bar */}
          <div className="flex-shrink-0 px-2 py-2 bg-gray-100 dark:bg-gray-800/50">
            <div className="flex items-center gap-1.5">
              {/* Method Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowMethodDropdown(!showMethodDropdown)}
                  className={`select-none px-2 py-1.5 rounded-md text-white text-[13px] font-semibold min-w-[80px] flex items-center justify-between transition-all duration-200 ${METHOD_COLORS[currentRequest.method].bg}`}
                >
                  <span>{currentRequest.method}</span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </button>
                {showMethodDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMethodDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl z-20 overflow-hidden min-w-[100px] py-1 select-none">
                      {HTTP_METHODS.map((method) => (
                        <button
                          key={method}
                          onClick={() => {
                            updateCurrentRequest({ method })
                            setShowMethodDropdown(false)
                          }}
                          className={`w-full px-2 py-1.5 text-left text-[13px] font-medium transition-colors ${
                            method === currentRequest.method
                              ? `${getStatusBg(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method) ? method === 'GET' ? 200 : method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200 : 200)} ${METHOD_COLORS[method].text}`
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* URL Input */}
            <div className="flex-1">
              <VariableInput
                value={currentRequest.url}
                onChange={(url) => updateCurrentRequest({ url })}
                placeholder={t('api.enterUrl')}
                variables={activeVariables}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Send/Cancel Button */}
            {loading ? (
              <button
                onClick={handleCancel}
                className="select-none px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold rounded-md flex items-center gap-1.5 transition-all duration-200"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{t('common.cancel')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 select-none">
                <button
                  onClick={handleSend}
                  disabled={!currentRequest.url}
                  className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-[13px] font-semibold rounded-md flex items-center gap-1.5 transition-all duration-200 disabled:cursor-not-allowed"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('api.send')}</span>
                </button>
                {/* Timeout Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowTimeoutDropdown(!showTimeoutDropdown)}
                    className="select-none px-1.5 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all flex items-center gap-1 text-[11px]"
                    title={t('api.timeoutSettings')}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{Math.round((currentRequest.timeout || 30000) / 1000)}s</span>
                  </button>
                  {showTimeoutDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowTimeoutDropdown(false)} />
                      <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-xl z-20 overflow-hidden min-w-[120px] py-1 select-none">
                        {[5000, 10000, 30000, 60000, 120000, 300000].map((ms) => (
                          <button
                            key={ms}
                            onClick={() => {
                              updateCurrentRequest({ timeout: ms })
                              setShowTimeoutDropdown(false)
                            }}
                            className={`w-full px-2 py-1.5 text-left text-[13px] transition-colors ${
                              (currentRequest.timeout || 30000) === ms
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {ms >= 60000 ? `${ms / 60000}${t('api.minutes')}` : `${ms / 1000}${t('api.seconds')}`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={() => {
                setSaveName(currentRequest?.name || '')
                setSaveFolderId(null)
                setShowSaveModal(true)
              }}
              className="p-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-all"
              title={t('api.saveRequest')}
            >
              <Save className="w-3.5 h-3.5" />
            </button>

            {/* Generate Code Button */}
            <button
              onClick={() => setShowCodeModal(true)}
              className="p-1 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-all"
              title={t('api.generateCode')}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Request Tabs */}
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 select-none">
          <div className="flex items-center">
            {([
              { id: 'params', label: t('api.params'), count: currentRequest.params.filter(p => p.enabled && p.key).length },
              { id: 'headers', label: t('api.headers'), count: currentRequest.headers.filter(h => h.enabled && h.key).length },
              { id: 'body', label: t('api.body') },
              { id: 'auth', label: t('api.auth') },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-2 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                {'count' in tab && tab.count > 0 && (
                  <span className="ml-1 px-1 py-0.5 text-[11px] bg-gray-200 dark:bg-gray-700 rounded-full">
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'params' && (
            <KeyValueEditor
              data={currentRequest.params}
              onChange={(params) => updateCurrentRequest({ params })}
              keyPlaceholder={t('api.paramName')}
              valuePlaceholder={t('api.paramValue')}
              variables={activeVariables}
            />
          )}
          {activeTab === 'headers' && (
            <KeyValueEditor
              data={currentRequest.headers}
              onChange={(headers) => updateCurrentRequest({ headers })}
              keyPlaceholder={t('api.headerName')}
              valuePlaceholder={t('api.headerValue')}
              suggestions={['Content-Type', 'Authorization', 'Accept', 'User-Agent', 'Cache-Control', 'Cookie']}
              variables={activeVariables}
            />
          )}
          {activeTab === 'body' && (
            <BodyEditor
              body={currentRequest.body}
              onChange={(body) => updateCurrentRequest({ body })}
            />
          )}
          {activeTab === 'auth' && (
            <AuthEditor
              auth={currentRequest.auth}
              onChange={(auth) => updateCurrentRequest({ auth })}
              variables={activeVariables}
            />
          )}
        </div>

        {/* Sent Request Preview - 在发送后显示实际请求信息 */}
        {sentRequest && (
          <div
            className="border-t border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
            style={{ height: sentRequestOpen ? sentRequestHeight + 60 : 45 }}
          >
            {/* Header - 固定高度 */}
            <div
              className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 select-none"
              onClick={() => setSentRequestOpen(!sentRequestOpen)}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${sentRequestOpen ? 'rotate-180' : ''}`} />
              <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400">{t('api.actualRequestSent')}</span>
            </div>
            {/* 拖拽条 */}
            {sentRequestOpen && <VerticalResizableDivider onResize={handleSentRequestResize} />}
            {/* Content */}
            {sentRequestOpen && (
              <div className="flex-1 min-h-0 overflow-auto bg-white/50 dark:bg-gray-800/20">
                <div className="px-2 py-1.5 space-y-1.5 text-[11px]">
                  {/* Request Line */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`px-1.5 py-0.5 rounded font-bold select-none flex-shrink-0 ${getMethodColor(sentRequest.method)}`}>
                      {sentRequest.method}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 truncate" title={sentRequest.url}>{sentRequest.url}</span>
                  </div>

                  {/* Request Headers */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-1.5">
                    <div className="text-gray-500 dark:text-gray-400 mb-1 select-none">{t('api.headersLabel')}</div>
                    {Object.keys(sentRequest.headers).length > 0 ? (
                      Object.entries(sentRequest.headers).map(([key, value]) => (
                        <div key={key} className="flex gap-1.5 py-0.5 min-w-0">
                          <span className="text-gray-600 dark:text-gray-400 font-medium flex-shrink-0">{key}:</span>
                          <span className="text-gray-800 dark:text-gray-300 truncate" title={value as string}>{value as string}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-500 dark:text-gray-400 select-none">{t('api.noCustomHeaders')}</div>
                    )}
                  </div>

                  {/* Request Body */}
                  {sentRequest.body && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded p-1.5">
                      <div className="text-gray-500 dark:text-gray-400 mb-1 select-none">{t('api.bodyLabel')}</div>
                      <pre className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap break-words overflow-auto max-h-32">
                        {sentRequest.body}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resizable Divider */}
      <ResizableDivider onResize={handlePanelResize} />

      {/* Right: Response Panel */}
      <div
        className="flex flex-col min-w-0 bg-gray-50 dark:bg-gray-800/30"
        style={{ width: `${100 - requestPanelPercent}%` }}
      >
        <ResponsePanel
          response={currentResponse}
          error={currentError}
          loading={loading}
          onCopy={handleCopyResponse}
          copied={copied}
        />
      </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-md shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">
                {currentRequest?.id && findRequestById(currentRequest.id) ? t('api.updateRequest') : t('api.saveRequest')}
              </h3>
              <button onClick={() => setShowSaveModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('api.requestName')}</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t('api.enterRequestName')}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{t('api.saveLocation')}</label>
                <select
                  value={saveFolderId || ''}
                  onChange={(e) => setSaveFolderId(e.target.value || null)}
                  className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {folderOptions.map(opt => (
                    <option key={opt.id || 'root'} value={opt.id || ''}>
                      {'  '.repeat(opt.depth)}{opt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800/50 flex justify-end gap-1.5">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-2 py-1.5 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1.5 text-[13px] font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                {currentRequest?.id && findRequestById(currentRequest.id) ? t('common.update') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Generation Modal */}
      {showCodeModal && currentRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCodeModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-[13px] font-semibold text-gray-900 dark:text-white">{t('api.generateCode')}</h3>
              <button onClick={() => setShowCodeModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Target Selector */}
            <div className="px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5">
                {(['curl', 'fetch', 'axios', 'javascript'] as CodeTarget[]).map((target) => (
                  <button
                    key={target}
                    onClick={() => setCodeTarget(target)}
                    className={`px-2 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                      codeTarget === target
                        ? 'bg-purple-500 text-white shadow-md'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {target === 'curl' ? 'cURL' : target === 'javascript' ? 'XHR' : target.charAt(0).toUpperCase() + target.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Preview */}
            <div className="p-3 max-h-[400px] overflow-auto">
              <pre className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-3 rounded-md text-[13px] font-mono whitespace-pre-wrap overflow-auto">
                {generateCode(currentRequest, codeTarget)}
              </pre>
            </div>

            {/* Footer */}
            <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800/50 flex justify-end gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generateCode(currentRequest, codeTarget))
                  setCodeCopied(true)
                  setTimeout(() => setCodeCopied(false), 2000)
                }}
                className="px-2 py-1.5 text-[13px] font-medium flex items-center gap-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
              >
                {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {codeCopied ? t('redis.copied') : t('api.copyCode')}
              </button>
              <button
                onClick={() => setShowCodeModal(false)}
                className="px-2 py-1.5 text-[13px] font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Variable Autocomplete Input Component
function VariableInput({
  value,
  onChange,
  placeholder,
  variables,
  className = '',
  type = 'text',
  onKeyDown,
  title,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  variables: { key: string; value: string }[]
  className?: string
  type?: 'text' | 'password'
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  title?: string
}) {
  const { t } = useTranslation()
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [hoveredVar, setHoveredVar] = useState<{ key: string; value: string; rect: DOMRect } | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 解析文本中的变量位置
  const parseVariables = (text: string) => {
    const regex = /\{\{(\w+)\}\}/g
    const parts: { text: string; isVar: boolean; varKey?: string }[] = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), isVar: false })
      }
      parts.push({ text: match[0], isVar: true, varKey: match[1] })
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), isVar: false })
    }
    return parts.length > 0 ? parts : [{ text, isVar: false }]
  }

  const handleVarHover = (varKey: string, element: HTMLElement) => {
    const varInfo = variables.find(v => v.key === varKey)
    if (varInfo) {
      const rect = element.getBoundingClientRect()
      setHoveredVar({ key: varInfo.key, value: varInfo.value, rect })
    }
  }

  const handleVarLeave = () => {
    setHoveredVar(null)
  }

  const checkVariableTrigger = (inputValue: string, cursorPos: number) => {
    const beforeCursor = inputValue.slice(0, cursorPos)
    const match = beforeCursor.match(/\{\{?$/)
    if (match) {
      setShowDropdown(true)
      setSelectedIndex(0)
    } else {
      setShowDropdown(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    checkVariableTrigger(newValue, e.target.selectionStart || 0)
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '{') {
      const input = e.currentTarget
      const cursorPos = input.selectionStart || 0
      checkVariableTrigger(value, cursorPos)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 先处理变量下拉选择
    if (showDropdown && variables.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, variables.length - 1))
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        return
      } else if (e.key === 'Enter') {
        e.preventDefault()
        selectVariable(variables[selectedIndex].key)
        return
      } else if (e.key === 'Escape') {
        setShowDropdown(false)
        return
      }
    }
    // 调用外部的 onKeyDown
    onKeyDown?.(e)
  }

  const selectVariable = (varKey: string) => {
    const input = inputRef.current
    if (!input) return

    const cursorPos = input.selectionStart || 0
    const beforeCursor = value.slice(0, cursorPos)
    const match = beforeCursor.match(/\{\{?$/)

    if (match) {
      const startPos = cursorPos - match[0].length
      const newValue = value.slice(0, startPos) + `{{${varKey}}}` + value.slice(cursorPos)
      onChange(newValue)
      setShowDropdown(false)

      setTimeout(() => {
        const newCursorPos = startPos + `{{${varKey}}}`.length
        input.setSelectionRange(newCursorPos, newCursorPos)
        input.focus()
      }, 0)
    }
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 当其他输入框获得焦点时清除悬浮提示
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      // 如果焦点不在当前组件内，清除悬浮提示
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHoveredVar(null)
      }
    }
    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  const inputClass = className || 'w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'

  const parts = parseVariables(value)
  const hasVariables = parts.some(p => p.isVar)
  const showHighlight = value && type !== 'password' && hasVariables && !isFocused

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 输入框 - 始终存在 */}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={() => {
          setIsFocused(true)
          setHoveredVar(null) // 获得焦点时清除悬浮提示
        }}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        title={title}
        spellCheck={false}
        autoComplete="off"
        className={`${inputClass} ${showHighlight ? 'opacity-0 absolute inset-0 z-0' : ''}`}
      />

      {/* 变量高亮显示层 - 失去焦点时覆盖显示 */}
      {showHighlight && (
        <div
          className={`${inputClass} cursor-text min-h-[32px] flex items-center flex-wrap gap-0.5 relative z-10`}
          onClick={() => inputRef.current?.focus()}
          onMouseLeave={handleVarLeave}
        >
          {parts.map((part, index) => (
            part.isVar ? (
              <span
                key={index}
                className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors text-[13px]"
                onMouseEnter={(e) => handleVarHover(part.varKey!, e.currentTarget)}
                onMouseLeave={handleVarLeave}
              >
                {part.text}
              </span>
            ) : (
              <span key={index} className="text-[13px] text-gray-900 dark:text-gray-100">{part.text}</span>
            )
          ))}
        </div>
      )}

      {/* 悬浮提示 */}
      {hoveredVar && createPortal(
        <div
          className="fixed z-[100] bg-gray-800 dark:bg-gray-700 text-white text-[11px] px-2 py-1.5 rounded-md shadow-xl max-w-[300px] overflow-hidden border border-gray-600 dark:border-gray-600"
          style={{
            top: hoveredVar.rect.top - 36,
            left: hoveredVar.rect.left + hoveredVar.rect.width / 2,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-blue-300 font-mono">{`{{${hoveredVar.key}}}`}</span>
            <span className="text-gray-500">→</span>
            <span className="text-green-300 font-mono truncate">{hoveredVar.value || t('api.empty')}</span>
          </div>
        </div>,
        document.body
      )}

      {showDropdown && variables.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-20 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[160px] max-h-48 overflow-y-auto"
        >
          <div className="px-1.5 py-1 text-[11px] text-gray-400 border-b border-gray-100 dark:border-gray-700">
            {t('api.environmentVariables')}
          </div>
          {variables.map((v, index) => (
            <button
              key={v.key}
              onClick={() => selectVariable(v.key)}
              className={`w-full px-2 py-1.5 text-left text-[13px] flex items-center justify-between transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <code className="font-mono">{v.key}</code>
              <span className="text-[11px] text-gray-400 truncate max-w-[100px]" title={v.value}>{v.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Key-Value Editor Component
function KeyValueEditor({
  data,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  suggestions = [],
  variables = [],
}: {
  data: KeyValue[]
  onChange: (data: KeyValue[]) => void
  keyPlaceholder: string
  valuePlaceholder: string
  suggestions?: string[]
  variables?: { key: string; value: string }[]
}) {
  const { t } = useTranslation()
  const updateRow = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const newData = [...data]
    newData[index] = { ...newData[index], [field]: value }
    onChange(newData)
  }

  const addRow = () => {
    onChange([...data, { key: '', value: '', enabled: true }])
  }

  const removeRow = (index: number) => {
    onChange(data.filter((_, i) => i !== index))
  }

  const toggleEnabled = (index: number) => {
    updateRow(index, 'enabled', !data[index].enabled)
  }

  const enabledCount = data.filter(item => item.enabled).length

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable table */}
      <div className="flex-1 overflow-auto min-h-0 px-2 pt-1.5">
        {/* Table Header */}
        <div className="sticky top-0 z-10 flex items-center h-9 px-1 mb-1 bg-white dark:bg-gray-900 select-none">
          <div className="w-[40px] flex-shrink-0" />
          <div className="flex-1 min-w-0 px-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{keyPlaceholder}</div>
          <div className="flex-1 min-w-0 px-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{valuePlaceholder}</div>
          <div className="w-[72px] flex-shrink-0 text-[11px] font-medium text-gray-400 dark:text-gray-500 text-right pr-1">
            {data.length > 0 && <span>{enabledCount}/{data.length}</span>}
          </div>
        </div>

        {/* Table Body */}
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
            <div className="text-[13px]">{t('api.noParams')}</div>
          </div>
        ) : (
          <div className="space-y-1">
            {data.map((item, index) => (
              <div
                key={index}
                className={`group flex items-center h-11 px-1 rounded-md transition-all ${
                  !item.enabled
                    ? 'opacity-40'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {/* Enable Toggle */}
                <div className="w-[40px] flex-shrink-0 flex justify-center">
                  <button
                    onClick={() => toggleEnabled(index)}
                    className={`w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all ${
                      item.enabled
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                        : 'border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                  >
                    {item.enabled && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                </div>

                {/* Key Input */}
                <div className="flex-1 min-w-0 px-2">
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => updateRow(index, 'key', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && item.key && addRow()}
                    placeholder={keyPlaceholder}
                    spellCheck={false}
                    className="w-full px-2 py-1.5 text-[13px] font-mono bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none rounded-md text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                    title={item.key}
                    list={suggestions.length > 0 ? `kv-suggestions-${keyPlaceholder}` : undefined}
                  />
                </div>

                {/* Value Input */}
                <div className="flex-1 min-w-0 px-2">
                  <VariableInput
                    value={item.value}
                    onChange={(val) => updateRow(index, 'value', val)}
                    onKeyDown={(e) => e.key === 'Enter' && addRow()}
                    placeholder={valuePlaceholder}
                    variables={variables}
                    className="w-full px-2 py-1.5 text-[13px] font-mono bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none rounded-md text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                    title={item.value}
                  />
                </div>

                {/* Delete Button */}
                <div className="w-[72px] flex-shrink-0 flex justify-end pr-1">
                  <button
                    onClick={() => removeRow(index)}
                    className="w-7 h-7 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Button */}
      <div className="flex-shrink-0 h-11 px-4 flex items-center border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 text-[13px] text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 px-2 py-1.5 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('api.addParam')}
        </button>
      </div>

      {suggestions.length > 0 && (
        <datalist id={`kv-suggestions-${keyPlaceholder}`}>
          {suggestions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
    </div>
  )
}

// Type Select Dropdown for Multipart
function TypeSelect({
  type,
  onChange,
}: {
  type: 'text' | 'file'
  onChange: (type: 'text' | 'file') => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1.5 py-1 text-[11px] rounded-md border border-gray-200 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.06] hover:border-gray-300 dark:hover:border-gray-600 transition-all min-w-[56px] justify-between"
      >
        <span className={type === 'file' ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'}>
          {type === 'file' ? t('api.file') : t('api.text')}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-20 overflow-hidden py-1 min-w-[72px]">
            <button
              onClick={() => { onChange('text'); setOpen(false) }}
              className={`w-full px-2 py-1.5 text-[11px] text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${type === 'text' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
            >
              {t('api.text')}
            </button>
            <button
              onClick={() => { onChange('file'); setOpen(false) }}
              className={`w-full px-2 py-1.5 text-[11px] text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 ${type === 'file' ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' : ''}`}
            >
              {t('api.file')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Body Editor Component
function BodyEditor({
  body,
  onChange,
}: {
  body: RequestBody
  onChange: (body: RequestBody) => void
}) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const bodyTypes: { type: RequestBody['type']; label: string; icon: React.ReactNode }[] = [
    { type: 'none', label: t('api.none'), icon: <X className="w-3.5 h-3.5" /> },
    { type: 'json', label: t('api.json'), icon: <Braces className="w-3.5 h-3.5" /> },
    { type: 'form-data', label: t('api.formData'), icon: <Upload className="w-3.5 h-3.5" /> },
    { type: 'x-www-form-urlencoded', label: t('api.formUrlencoded'), icon: <FormInput className="w-3.5 h-3.5" /> },
    { type: 'raw', label: t('api.raw'), icon: <FileCode className="w-3.5 h-3.5" /> },
    { type: 'binary', label: t('api.binary'), icon: <FileText className="w-3.5 h-3.5" /> },
  ]

  const rawTypes: RequestBody['rawType'][] = ['text', 'xml', 'html', 'javascript']

  // 初始化formData
  const ensureFormData = () => {
    if (!body.formData) {
      onChange({ ...body, formData: [] })
    }
  }

  // 添加表单字段
  const addFormField = () => {
    const newField: FormField = { key: '', value: '', type: 'text', enabled: true }
    onChange({ ...body, formData: [...(body.formData || []), newField] })
  }

  // 更新表单字段
  const updateFormField = (index: number, field: keyof FormField, value: string | boolean) => {
    const newFormData = [...(body.formData || [])]
    newFormData[index] = { ...newFormData[index], [field]: value }
    onChange({ ...body, formData: newFormData })
  }

  // 删除表单字段
  const removeFormField = (index: number) => {
    onChange({ ...body, formData: (body.formData || []).filter((_, i) => i !== index) })
  }

  // 切换字段类型（text/file）
  const toggleFieldType = (index: number) => {
    const newFormData = [...(body.formData || [])]
    const field = newFormData[index]
    if (field.type === 'text') {
      newFormData[index] = { ...field, type: 'file', value: '', fileName: '', fileType: '' }
    } else {
      newFormData[index] = { ...field, type: 'text', fileName: undefined, fileType: undefined }
    }
    onChange({ ...body, formData: newFormData })
  }

  // 处理文件选择
  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      const newFormData = [...(body.formData || [])]
      newFormData[index] = {
        ...newFormData[index],
        value: base64.split(',')[1],
        fileName: file.name,
        fileType: file.type,
      }
      onChange({ ...body, formData: newFormData })
    }
    reader.readAsDataURL(file)
  }

  // 处理binary文件选择
  const handleBinaryFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      onChange({
        ...body,
        binaryFile: {
          name: file.name,
          type: file.type,
          data: base64.split(',')[1],
        },
      })
    }
    reader.readAsDataURL(file)
  }

  const formData = body.formData || []
  const enabledCount = formData.filter(f => f.enabled).length
  const totalCount = formData.length
  const isMultipart = body.type === 'form-data'

  return (
    <div className="h-full flex flex-col">
      {/* Type Selector */}
      <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1 flex-wrap select-none">
          {bodyTypes.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                onChange({ ...body, type: t.type })
                if (t.type === 'form-data' || t.type === 'x-www-form-urlencoded') {
                  ensureFormData()
                }
              }}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] font-medium transition-all duration-200 ${
                body.type === t.type
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Raw Type Selector */}
      {body.type === 'raw' && (
        <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1.5 select-none">
          <span className="text-[11px] text-gray-500">{t('api.format')}:</span>
          <div className="flex items-center gap-1">
            {rawTypes.map((rt) => (
              <button
                key={rt}
                onClick={() => onChange({ ...body, rawType: rt })}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  (body.rawType || 'text') === rt
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {rt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor - JSON / Raw */}
      {(body.type === 'json' || body.type === 'raw') && (
        <div className="flex-1 relative min-h-0">
          <textarea
            value={body.content}
            onChange={(e) => onChange({ ...body, content: e.target.value })}
            placeholder={body.type === 'json' ? '{\n  "key": "value"\n}' : t('api.bodyContent')}
            className="w-full h-full px-2 py-1.5 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono text-[13px] border-0 resize-none focus:outline-none"
            spellCheck={false}
          />
        </div>
      )}

      {/* Editor - Form Data / X-WWW-Form-URLEncoded */}
      {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
        <>
          {/* Scrollable table */}
          <div className="flex-1 overflow-auto min-h-0 px-2 pt-1.5">
            {/* Table Header */}
            <div className="sticky top-0 z-10 flex items-center h-9 px-1 mb-1 bg-white dark:bg-gray-900 select-none">
              <div className="w-[40px] flex-shrink-0" />
              <div className="flex-1 min-w-0 px-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('api.fieldName')}</div>
              {isMultipart && (
                <div className="w-[72px] flex-shrink-0 px-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.type')}</div>
              )}
              <div className="flex-1 min-w-0 px-2 text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('common.value')}</div>
              <div className="w-[72px] flex-shrink-0 text-[11px] font-medium text-gray-400 dark:text-gray-500 text-right pr-1">
                {totalCount > 0 && <span>{enabledCount}/{totalCount}</span>}
              </div>
            </div>

            {/* Table Body */}
            {totalCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-500">
                <div className="text-[13px]">{t('api.noFormFields')}</div>
              </div>
            ) : (
              <div className="space-y-1">
                {formData.map((field, index) => (
                  <div
                    key={index}
                    className={`group flex items-center h-11 px-1 rounded-md transition-all ${
                      !field.enabled
                        ? 'opacity-40'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Enable Toggle */}
                    <div className="w-[40px] flex-shrink-0 flex justify-center">
                      <button
                        onClick={() => updateFormField(index, 'enabled', !field.enabled)}
                        className={`w-[18px] h-[18px] rounded-md flex items-center justify-center transition-all ${
                          field.enabled
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/25'
                            : 'border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {field.enabled && <Check className="w-3 h-3" strokeWidth={3} />}
                      </button>
                    </div>

                    {/* Key Input */}
                    <div className="flex-1 min-w-0 px-2">
                      <input
                        type="text"
                        value={field.key}
                        onChange={(e) => updateFormField(index, 'key', e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && field.key && addFormField()}
                        placeholder={t('api.fieldName')}
                        spellCheck={false}
                        className="w-full px-2 py-1.5 text-[13px] font-mono bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none rounded-md text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                        title={field.key}
                      />
                    </div>

                    {/* Type Select (only for form-data) */}
                    {isMultipart && (
                      <div className="w-[72px] flex-shrink-0 px-2 flex justify-center">
                        <TypeSelect
                          type={field.type}
                          onChange={(newType) => {
                            if (newType !== field.type) {
                              toggleFieldType(index)
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Value Input */}
                    <div className="flex-1 min-w-0 px-2">
                      {(!isMultipart || field.type === 'text') ? (
                        <input
                          type="text"
                          value={field.value || ''}
                          onChange={(e) => updateFormField(index, 'value', e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addFormField()}
                          placeholder={t('common.value')}
                          spellCheck={false}
                          className="w-full px-2 py-1.5 text-[13px] font-mono bg-transparent hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:bg-white dark:focus:bg-gray-800 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none rounded-md text-gray-800 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                          title={field.value}
                        />
                      ) : (
                        <div className="flex items-center min-w-0">
                          <input
                            type="file"
                            onChange={(e) => handleFileSelect(index, e)}
                            className="hidden"
                            id={`file-${index}`}
                          />
                          <button
                            onClick={() => document.getElementById(`file-${index}`)?.click()}
                            className="flex-1 text-left px-2 py-1.5 text-[13px] rounded-md hover:bg-gray-100 dark:hover:bg-white/[0.06] border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all truncate"
                            title={field.fileName}
                          >
                            {field.fileName ? (
                              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 truncate">
                                <Paperclip className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{field.fileName}</span>
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">{t('api.selectFile')}</span>
                            )}
                          </button>
                          {field.fileName && (
                            <button
                              onClick={() => {
                                const newFormData = [...formData]
                                newFormData[index] = { ...newFormData[index], value: '', fileName: '', fileType: '' }
                                onChange({ ...body, formData: newFormData })
                              }}
                              className="p-1 text-gray-300 hover:text-red-500 rounded-md flex-shrink-0 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <div className="w-[72px] flex-shrink-0 flex justify-end pr-1">
                      <button
                        onClick={() => removeFormField(index)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Button */}
          <div className="flex-shrink-0 h-11 px-4 flex items-center border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={addFormField}
              className="flex items-center gap-1.5 text-[13px] text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 px-2 py-1.5 rounded-md transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('api.addField')}
            </button>
          </div>
        </>
      )}

      {/* Editor - Binary */}
      {body.type === 'binary' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleBinaryFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-1.5 text-[13px] font-medium transition-all shadow-lg hover:shadow-xl"
          >
            <Upload className="w-4 h-4" />
            {t('api.selectFile')}
          </button>
          {body.binaryFile && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-md">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[13px] text-gray-700 dark:text-gray-300">{body.binaryFile.name}</span>
              <button
                onClick={() => onChange({ ...body, binaryFile: undefined })}
                className="p-1 text-gray-400 hover:text-red-500 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* None */}
      {body.type === 'none' && (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <FileCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-[13px]">{t('api.noBody')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Auth Editor Component
function AuthEditor({
  auth,
  onChange,
  variables = [],
}: {
  auth: AuthConfig
  onChange: (auth: AuthConfig) => void
  variables?: { key: string; value: string }[]
}) {
  const { t: translate } = useTranslation()
  const authTypes: { type: AuthConfig['type']; label: string; desc: string }[] = [
    { type: 'none', label: translate('api.noAuth'), desc: translate('api.noAuthDesc') },
    { type: 'bearer', label: translate('api.bearerAuth'), desc: translate('api.bearerAuthDesc') },
    { type: 'basic', label: translate('api.basicAuth'), desc: translate('api.basicAuthDesc') },
    { type: 'api-key', label: translate('api.apiKeyAuth'), desc: translate('api.apiKeyDesc') },
  ]

  return (
    <div className="p-2">
      {/* Type Selector */}
      <div className="grid grid-cols-2 gap-1.5 mb-3 select-none">
        {authTypes.map((t) => (
          <button
            key={t.type}
            onClick={() => onChange({ type: t.type })}
            className={`p-2 rounded-md text-left transition-all duration-200 ${
              auth.type === t.type
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <div className="font-medium text-[13px]">{t.label}</div>
            <div className={`text-[11px] mt-0.5 ${auth.type === t.type ? 'text-blue-100' : 'text-gray-500'}`}>
              {t.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Auth Fields */}
      {auth.type === 'bearer' && (
        <div className="space-y-1.5">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('api.tokenLabel')}</label>
            <VariableInput
              value={auth.token || ''}
              onChange={(token) => onChange({ ...auth, token })}
              placeholder={translate('api.enterBearerToken')}
              variables={variables}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="space-y-1.5">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('database.username')}</label>
            <VariableInput
              value={auth.username || ''}
              onChange={(username) => onChange({ ...auth, username })}
              placeholder={translate('database.username')}
              variables={variables}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('database.password')}</label>
            <VariableInput
              value={auth.password || ''}
              onChange={(password) => onChange({ ...auth, password })}
              placeholder={translate('database.password')}
              variables={variables}
              type="password"
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {auth.type === 'api-key' && (
        <div className="space-y-1.5">
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('api.keyLabel')}</label>
            <input
              type="text"
              value={auth.apiKeyName || ''}
              onChange={(e) => onChange({ ...auth, apiKeyName: e.target.value })}
              placeholder={translate('api.apiKeyPlaceholderHeader')}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('api.valueLabel')}</label>
            <VariableInput
              value={auth.apiKeyValue || ''}
              onChange={(apiKeyValue) => onChange({ ...auth, apiKeyValue })}
              placeholder={translate('api.apiKeyPlaceholder')}
              variables={variables}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1">{translate('api.addTo')}</label>
            <div className="flex gap-1.5 select-none">
              {['header', 'query'].map((loc) => (
                <button
                  key={loc}
                  onClick={() => onChange({ ...auth, apiKeyLocation: loc as 'header' | 'query' })}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                    (auth.apiKeyLocation || 'header') === loc
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {loc === 'header' ? translate('api.headerLabel') : translate('api.queryParam')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Response Panel Component
function ResponsePanel({
  response,
  error,
  loading,
  onCopy,
  copied,
}: {
  response: any
  error: string | null
  loading: boolean
  onCopy: () => void
  copied: boolean
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // 响应大小颜色指示 (阈值: 100KB)
  const getSizeColor = (bytes: number) => {
    if (bytes < 100 * 1024) return 'text-emerald-500' // < 100KB: 绿色
    if (bytes < 1024 * 1024) return 'text-amber-500' // 100KB - 1MB: 黄色
    return 'text-red-500' // > 1MB: 红色
  }

  const getSizeWarning = (bytes: number) => {
    if (bytes >= 1024 * 1024) return t('api.largeResponseWarning')
    if (bytes >= 100 * 1024) return t('api.mediumResponseWarning')
    return null
  }

  // 格式化JSON
  const formatJson = (text: string) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }

  // 分块渲染阈值 (100KB)
  const CHUNK_THRESHOLD = 100 * 1024
  const CHUNK_LINES = 100 // 每块显示 100 行

  // 是否需要分块渲染
  const needsChunkedRender = response?.size && response.size >= CHUNK_THRESHOLD

  // 分块渲染状态
  const [visibleLines, setVisibleLines] = useState(CHUNK_LINES)

  // 重置分块状态当响应变化时
  useEffect(() => {
    setVisibleLines(CHUNK_LINES)
  }, [response?.body])

  // 获取分块内容
  const getChunkedContent = (formatted: string) => {
    const lines = formatted.split('\n')
    return {
      visible: lines.slice(0, visibleLines).join('\n'),
      totalLines: lines.length,
      remaining: lines.length - visibleLines,
    }
  }

  // 响应时间颜色指示
  const getTimeColor = (ms: number) => {
    if (ms < 200) return 'text-emerald-500' // < 200ms: 快
    if (ms < 1000) return 'text-blue-500' // 200ms - 1s: 正常
    if (ms < 5000) return 'text-amber-500' // 1s - 5s: 较慢
    return 'text-red-500' // > 5s: 慢
  }

  const getTimeLabel = (ms: number) => {
    if (ms < 200) return t('api.responseFast')
    if (ms < 1000) return t('api.responseNormal')
    if (ms < 5000) return t('api.responseSlow')
    return t('api.responseVerySlow')
  }

  // 响应类型识别
  const getResponseType = (headers: Record<string, string>) => {
    const contentType = headers['content-type'] || headers['Content-Type'] || ''
    if (contentType.includes('application/json')) return 'json'
    if (contentType.includes('application/xml') || contentType.includes('text/xml')) return 'xml'
    if (contentType.includes('text/html')) return 'html'
    if (contentType.includes('image/')) return 'image'
    if (contentType.includes('application/pdf')) return 'pdf'
    return 'other'
  }

  const responseTypeIcon = (type: string) => {
    switch (type) {
      case 'json': return <Braces className="w-3 h-3 text-blue-500" />
      case 'xml': return <FileCode className="w-3 h-3 text-orange-500" />
      case 'html': return <FileText className="w-3 h-3 text-purple-500" />
      case 'image': return <HardDrive className="w-3 h-3 text-green-500" />
      case 'pdf': return <FileText className="w-3 h-3 text-red-500" />
      default: return <FileText className="w-3 h-3 text-gray-500" />
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 select-none">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">{t('api.responseLabel')}</span>
          {response && (
            <div className="flex items-center gap-1.5 text-[11px]">
              {/* 状态码 */}
              <span className={`font-bold ${getStatusColor(response.status)}`}>
                {response.status} {response.statusText}
              </span>
              {/* 响应时间 */}
              <span className={`flex items-center gap-1 ${getTimeColor(response.time)}`} title={getTimeLabel(response.time)}>
                <Clock className="w-3 h-3" />
                {response.time}ms
              </span>
              {/* 响应大小 */}
              <span className={`flex items-center gap-1 ${getSizeColor(response.size)}`} title={getSizeWarning(response.size) || ''}>
                <HardDrive className="w-3 h-3" />
                {formatSize(response.size)}
                {response.size >= 100 * 1024 && <span className="text-[11px] opacity-70">⚠</span>}
              </span>
              {/* 响应类型 */}
              {responseTypeIcon(getResponseType(response.headers))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-500 text-[13px]">{t('api.sendingRequest')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-2">
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-start gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-red-700 dark:text-red-400">{t('api.requestFailed')}</p>
                  <p className="text-[13px] text-red-600 dark:text-red-300 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          </div>
        ) : response ? (
          <>
            {/* Tabs */}
            <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 select-none">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveTab('body')}
                  className={`px-2 py-1.5 text-[13px] font-medium transition-colors ${
                    activeTab === 'body'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t('api.bodyTab')}
                </button>
                <button
                  onClick={() => setActiveTab('headers')}
                  className={`px-2 py-1.5 text-[13px] font-medium transition-colors ${
                    activeTab === 'headers'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {t('api.headersTab')}
                </button>
                {activeTab === 'body' && (
                  <button
                    onClick={onCopy}
                    className="ml-auto mr-1.5 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                    title={t('api.copyResponse')}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'body' ? (
              needsChunkedRender ? (
                <div className="flex flex-col h-full">
                  <div className="px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>⚠</span>
                    <span>{t('api.largeResponseHint')}</span>
                  </div>
                  <pre className="flex-1 p-2 text-[13px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-auto">
                    {(() => {
                      const formatted = formatJson(response.body)
                      const chunked = getChunkedContent(formatted)
                      return chunked.visible
                    })()}
                  </pre>
                  {(() => {
                    const formatted = formatJson(response.body)
                    const chunked = getChunkedContent(formatted)
                    return chunked.remaining > 0 && (
                      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {t('api.linesRemaining', { count: chunked.remaining })}
                        </span>
                        <button
                          onClick={() => setVisibleLines(prev => prev + CHUNK_LINES)}
                          className="px-1.5 py-0.5 text-[11px] bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-0.5"
                        >
                          <span>{t('api.loadMore')}</span>
                        </button>
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <pre className="p-2 text-[13px] font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-auto">
                  {formatJson(response.body)}
                </pre>
              )
            ) : (
              <div className="p-2">
                <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {Object.entries(response.headers).map(([key, value], index) => (
                    <div
                      key={key}
                      className={`flex items-center py-1 px-2 ${
                        index !== 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''
                      }`}
                    >
                      <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400 w-32 flex-shrink-0 truncate" title={key}>
                        {key}
                      </span>
                      <span className="text-[13px] text-gray-800 dark:text-gray-200 truncate" title={value as string}>
                        {value as string}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Send className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-[13px]">{t('api.viewResponseAfterSend')}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{t('api.ctrlEnterHint')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}