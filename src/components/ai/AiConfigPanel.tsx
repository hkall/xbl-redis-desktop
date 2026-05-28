import React, { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  Check,
  Settings,
  Sparkles,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Zap,
  Clock,
} from 'lucide-react'
import { useAiStore, AIConfig, AIProvider, AI_PROVIDER_CONFIGS } from '@/store/aiStore'
import { useTranslation } from '@/store/i18nStore'
import { testConnection } from '@/services/aiService'

// AI提供商选择器
function ProviderSelector({
  provider,
  onChange,
}: {
  provider: AIProvider
  onChange: (provider: AIProvider) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="relative">
      <select
        value={provider}
        onChange={(e) => onChange(e.target.value as AIProvider)}
        className="w-full px-2 py-1.5 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Object.entries(AI_PROVIDER_CONFIGS).map(([key, config]) => (
          <option key={key} value={key}>
            {config.name}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  )
}

// 单个AI配置卡片
function ConfigCard({
  config,
  isActive,
  onSelect,
  onUpdate,
  onDelete,
}: {
  config: AIConfig & { id: string }
  isActive: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<AIConfig>) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null)
  const providerConfig = AI_PROVIDER_CONFIGS[config.provider]

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(config)
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div
      className={`border rounded-md p-3 transition-colors ${
        isActive
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
      }`}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onSelect}
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
              isActive
                ? 'border-blue-500 bg-blue-500'
                : 'border-gray-300 dark:border-gray-500 hover:border-blue-400'
            }`}
          >
            {isActive && <Check className="w-3 h-3 text-white" />}
          </button>
          <span className="text-[13px] font-medium text-gray-900 dark:text-white">
            {providerConfig.name}
          </span>
          {config.enabled ? (
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
          )}
          {/* 显示配置名称（如果有） */}
          {config.name && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              ({config.name})
            </span>
          )}
        </div>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 配置项 */}
      <div className="space-y-2">
        {/* 配置名称 */}
        <div>
          <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {t('ai.configName')}
          </label>
          <input
            type="text"
            value={config.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder={t('ai.configNamePlaceholder')}
            className="w-full px-2 py-1.5 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 提供商选择 */}
        <div>
          <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {t('ai.provider')}
          </label>
          <ProviderSelector
            provider={config.provider}
            onChange={(p) => onUpdate({ provider: p })}
          />
        </div>

        {/* API密钥 */}
        <div>
          <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {t('ai.apiKey')}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={config.apiKey}
              onChange={(e) => onUpdate({ apiKey: e.target.value })}
              placeholder={t('ai.apiKeyPlaceholder')}
              className="w-full px-2 py-1.5 pr-8 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* API地址（需要自定义或自定义提供商时显示） */}
        {(providerConfig.requiresBaseUrl || config.provider === 'custom') && (
          <div>
            <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
              {t('ai.baseUrl')}
            </label>
            <input
              type="text"
              value={config.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              placeholder={providerConfig.defaultBaseUrl || t('ai.baseUrlPlaceholder')}
              className="w-full px-2 py-1.5 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* 模型选择 */}
        <div>
          <label className="block text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {t('ai.model')}
          </label>
          {config.provider === 'custom' ? (
            <input
              type="text"
              value={config.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              placeholder={t('ai.modelPlaceholder')}
              className="w-full px-2 py-1.5 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="relative">
              <select
                value={config.model}
                onChange={(e) => onUpdate({ model: e.target.value })}
                className="w-full px-2 py-1.5 text-[13px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {providerConfig.models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>

        {/* 启用状态 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate({ enabled: !config.enabled })}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              config.enabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform ${
                config.enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-[13px] text-gray-600 dark:text-gray-300">
            {config.enabled ? t('ai.enabled') : t('ai.disabled')}
          </span>
        </div>

        {/* 测试连通性 */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleTest}
            disabled={testing || !config.apiKey || !config.model}
            className="flex items-center gap-1 px-2 py-1 text-[11px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {testing ? (
              <Settings className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {testing ? t('ai.testing') : t('ai.testConnection')}
          </button>

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-1 text-[11px] ${
              testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {testResult.success ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <AlertCircle className="w-3 h-3" />
              )}
              <span>{testResult.message}</span>
              {testResult.latency && (
                <span className="text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                  <Clock className="w-3 h-3" />
                  {testResult.latency}ms
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AiConfigPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const {
    configs,
    activeConfigId,
    addConfig,
    updateConfig,
    deleteConfig,
    setActiveConfig,
  } = useAiStore()

  // 添加新配置
  const handleAddConfig = () => {
    const defaultProvider: AIProvider = 'openai'
    const providerConfig = AI_PROVIDER_CONFIGS[defaultProvider]

    addConfig({
      provider: defaultProvider,
      apiKey: '',
      baseUrl: providerConfig.defaultBaseUrl,
      model: providerConfig.defaultModel,
      enabled: true,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-md shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
              {t('ai.configTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 说明 */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('ai.configHint')}
          </p>
        </div>

        {/* 配置列表 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {configs.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">
                {t('ai.noConfig')}
              </p>
              <button
                onClick={handleAddConfig}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-medium rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('ai.addConfig')}
              </button>
            </div>
          ) : (
            <>
              {configs.map((config) => (
                <ConfigCard
                  key={config.id}
                  config={config}
                  isActive={config.id === activeConfigId}
                  onSelect={() => setActiveConfig(config.id)}
                  onUpdate={(updates) => updateConfig(config.id, updates)}
                  onDelete={() => deleteConfig(config.id)}
                />
              ))}

              {/* 添加按钮 */}
              <button
                onClick={handleAddConfig}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('ai.addConfig')}
              </button>
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[11px] text-gray-400 dark:text-gray-500">
            {configs.length > 0 && activeConfigId
              ? `${t('ai.activeConfig')}: ${AI_PROVIDER_CONFIGS[configs.find(c => c.id === activeConfigId)?.provider || 'openai'].name}`
              : t('ai.noActiveConfig')
            }
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}