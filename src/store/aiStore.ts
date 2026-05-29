import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// AI提供商类型
export type AIProvider = 'openai' | 'anthropic' | 'google' | 'azure' | 'deepseek' | 'zhipu' | 'baidu' | 'alibaba' | 'custom'

// AI配置
export interface AIConfig {
  name?: string       // 配置名称（用户自定义）
  provider: AIProvider
  apiKey: string
  baseUrl: string  // 自定义API地址
  model: string    // 模型名称
  enabled: boolean
  timeout?: number  // 超时时间(毫秒)，默认120000
}

// 提供商预设配置
export const AI_PROVIDER_CONFIGS: Record<AIProvider, {
  name: string
  defaultBaseUrl: string
  defaultModel: string
  models: string[]
  requiresBaseUrl: boolean
}> = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    requiresBaseUrl: false,
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: ['claude-opus-4-20250514', 'claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    requiresBaseUrl: false,
  },
  google: {
    name: 'Google (Gemini)',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresBaseUrl: false,
  },
  azure: {
    name: 'Azure OpenAI',
    defaultBaseUrl: '',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo'],
    requiresBaseUrl: true,  // Azure需要自定义部署地址
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    requiresBaseUrl: false,
  },
  zhipu: {
    name: '智谱AI (GLM)',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air'],
    requiresBaseUrl: false,
  },
  baidu: {
    name: '百度AI (文心)',
    defaultBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    defaultModel: 'ERNIE-4.0-8K',
    models: ['ERNIE-4.0-8K', 'ERNIE-3.5-8K', 'ERNIE-Speed-8K'],
    requiresBaseUrl: false,
  },
  alibaba: {
    name: '阿里云 (通义)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'],
    requiresBaseUrl: false,
  },
  custom: {
    name: '自定义 (OpenAI兼容)',
    defaultBaseUrl: '',
    defaultModel: '',
    models: [],
    requiresBaseUrl: true,
  },
}

// AI功能类型
export type AIFeatureType = 'sql-generate' | 'sql-explain' | 'data-generate' | 'sql-analyze'

// SQL分析结果类型
export interface SQLAnalysisResult {
  // 语义解释
  summary: string           // 功能概述
  executionSteps: string[]  // 执行步骤描述

  // 性能分析
  performanceScore: number  // 0-100分
  issues: Array<{
    type: 'index' | 'join' | 'scan' | 'function' | 'limit' | 'security' | 'other'
    severity: 'high' | 'medium' | 'low'
    description: string
    suggestion: string
  }>

  // 优化建议
  indexSuggestions: string[]     // 索引建议SQL
  rewrittenSQL?: string          // 重写后的SQL
  optimizationTips: string[]     // 其他优化提示

  // 安全检查
  securityIssues: Array<{
    type: 'injection' | 'dangerous' | 'permission' | 'other'
    severity: 'high' | 'medium' | 'low'
    description: string
  }>

  // 兼容性
  compatibilityNotes?: string[]  // 跨数据库兼容性说明
}

// 表结构信息
export interface TableSchemaInfo {
  tableName: string
  columns: Array<{
    name: string
    type: string
    comment?: string
    nullable?: boolean
    primaryKey?: boolean
  }>
  comment?: string
}

// 数据库表简要信息（用于意图匹配）
export interface DatabaseTableInfo {
  name: string
  comment?: string
  type?: string  // TABLE, VIEW等
}

// AI请求参数
export interface AIRequestParams {
  featureType: AIFeatureType
  prompt: string
  context?: {
    databaseType?: string
    tableName?: string
    // 增强：完整的表结构信息
    tableSchema?: TableSchemaInfo
    // 增强：当前数据库所有表的列表（用于意图匹配）
    databaseTables?: DatabaseTableInfo[]
    // 增强：相关表的列表（用于JOIN建议）
    relatedTables?: string[]
    // 增强：示例数据（前几行）
    sampleData?: Record<string, any>[]
    existingSql?: string
    // 增强：多轮对话历史
    conversationHistory?: Array<{
      role: 'user' | 'assistant'
      content: string
      sql?: string
    }>
    // 增强：执行错误信息（用于修复）
    executionError?: string
  }
}

// AI响应结果
export interface AIResponse {
  success: boolean
  content?: string
  error?: string
  // 增强：是否为危险SQL
  isDangerous?: boolean
  dangerReason?: string
  // API延迟时间（毫秒）
  latency?: number
}

// 每个功能类型的独立状态
interface FeatureState {
  input: string
  output: string
  loading: boolean
}

// AI状态
interface AIState {
  // 配置列表（支持多个配置）
  configs: AIConfig[]
  activeConfigId: string | null

  // 是否显示配置面板
  showConfigPanel: boolean

  // 按功能类型独立存储状态
  featureStates: Record<AIFeatureType, FeatureState>

  // 操作方法
  addConfig: (config: AIConfig) => void
  updateConfig: (id: string, config: Partial<AIConfig>) => void
  deleteConfig: (id: string) => void
  setActiveConfig: (id: string | null) => void

  setShowConfigPanel: (show: boolean) => void

  // 按功能类型操作
  getFeatureState: (featureType: AIFeatureType) => FeatureState
  setFeatureInput: (featureType: AIFeatureType, input: string) => void
  setFeatureOutput: (featureType: AIFeatureType, output: string) => void
  setFeatureLoading: (featureType: AIFeatureType, loading: boolean) => void
  clearFeatureState: (featureType: AIFeatureType) => void

  // 获取当前激活的配置
  getActiveConfig: () => AIConfig | null

  // 检查是否有可用配置
  hasValidConfig: () => boolean
}

// 生成唯一ID
const generateId = () => `ai-config-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// 初始化各功能类型的默认状态
const initialFeatureStates: Record<AIFeatureType, FeatureState> = {
  'sql-generate': { input: '', output: '', loading: false },
  'sql-explain': { input: '', output: '', loading: false },
  'data-generate': { input: '', output: '', loading: false },
  'sql-analyze': { input: '', output: '', loading: false },
}

export const useAiStore = create<AIState>()(
  persist(
    (set, get) => ({
      configs: [],
      activeConfigId: null,
      showConfigPanel: false,
      featureStates: initialFeatureStates,

      addConfig: (config) => {
        const id = generateId()
        set((state) => ({
          configs: [...state.configs, { ...config, id }],
          activeConfigId: state.activeConfigId || id,
        }))
      },

      updateConfig: (id, config) => {
        set((state) => ({
          configs: state.configs.map((c) =>
            c.id === id ? { ...c, ...config } : c
          ),
        }))
      },

      deleteConfig: (id) => {
        set((state) => ({
          configs: state.configs.filter((c) => c.id !== id),
          activeConfigId: state.activeConfigId === id
            ? (state.configs.find((c) => c.id !== id)?.id || null)
            : state.activeConfigId,
        }))
      },

      setActiveConfig: (id) => {
        set({ activeConfigId: id })
      },

      setShowConfigPanel: (show) => {
        set({ showConfigPanel: show })
      },

      getFeatureState: (featureType) => {
        return get().featureStates[featureType] || { input: '', output: '', loading: false }
      },

      setFeatureInput: (featureType, input) => {
        set((state) => ({
          featureStates: {
            ...state.featureStates,
            [featureType]: { ...state.featureStates[featureType], input },
          },
        }))
      },

      setFeatureOutput: (featureType, output) => {
        set((state) => ({
          featureStates: {
            ...state.featureStates,
            [featureType]: { ...state.featureStates[featureType], output },
          },
        }))
      },

      setFeatureLoading: (featureType, loading) => {
        set((state) => ({
          featureStates: {
            ...state.featureStates,
            [featureType]: { ...state.featureStates[featureType], loading },
          },
        }))
      },

      clearFeatureState: (featureType) => {
        set((state) => ({
          featureStates: {
            ...state.featureStates,
            [featureType]: { input: '', output: '', loading: false },
          },
        }))
      },

      getActiveConfig: () => {
        const state = get()
        return state.configs.find((c) => c.id === state.activeConfigId) || null
      },

      hasValidConfig: () => {
        const state = get()
        const activeConfig = state.configs.find((c) => c.id === state.activeConfigId)
        return activeConfig?.enabled && activeConfig?.apiKey && activeConfig?.model
      },
    }),
    {
      name: 'xbl-ai-config',
      partialize: (state) => ({
        configs: state.configs,
        activeConfigId: state.activeConfigId,
      }),
    }
  )
)