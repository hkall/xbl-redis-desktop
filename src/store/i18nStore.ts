import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import en from '@/locales/en'
import zh from '@/locales/zh'

export type Language = 'en' | 'zh'

export const LANGUAGE_CONFIG: Record<Language, { label: string; nativeLabel: string }> = {
  en: { label: 'English', nativeLabel: 'English' },
  zh: { label: 'Chinese', nativeLabel: '中文' },
}

type Translation = typeof en

const translations: Record<Language, Translation> = { en, zh }

interface I18nState {
  language: Language
  t: Translation
  setLanguage: (lang: Language) => void
  getLanguage: () => Language
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      language: 'en', // 默认英文
      t: en,

      setLanguage: (lang) => {
        set({
          language: lang,
          t: translations[lang],
        })
      },

      getLanguage: () => get().language,
    }),
    {
      name: 'xbl-i18n',
      partialize: (state) => ({
        language: state.language,
      }),
      // 恢复后同步翻译对象
      onRehydrateStorage: () => (state) => {
        if (state && state.language) {
          state.t = translations[state.language]
        }
      },
    }
  )
)

// 便捷访问翻译函数
export const t = (key: string, params?: Record<string, string | number>): string => {
  const { t: translations } = useI18n.getState()

  // 支持 'redis.keys' 这样的点分隔路径
  const keys = key.split('.')
  let value: any = translations

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      return key // 找不到翻译，返回原始 key
    }
  }

  if (typeof value !== 'string') {
    return key
  }

  // 替换参数，如 '{count}' 替换为实际值
  if (params) {
    return Object.entries(params).reduce(
      (str, [paramKey, paramValue]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue)),
      value
    )
  }

  return value
}

// Hook 形式，用于组件中
export function useTranslation() {
  const { language, t: translations } = useI18n()

  const translate = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.')
    let value: any = translations

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key
      }
    }

    if (typeof value !== 'string') {
      return key
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [paramKey, paramValue]) => str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue)),
        value
      )
    }

    return value
  }

  return { t: translate, language }
}