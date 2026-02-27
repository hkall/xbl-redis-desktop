/**
 * 格式化数据用于显示,自动美化 JSON 格式
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatDataForDisplay(_value: string | null | undefined): string {
  // This function is exported but not currently used - returning empty for now
  return ''
}

// Custom JSON stringify with proper handling
export function customStringify(obj: any, indent: number = 2): string {
  return JSON.stringify(obj, (_key, val) => {
    if (typeof val === 'bigint') {
      return val.toString()
    }
    if (val === undefined) {
      return null
    }
    return val
  }, indent)
}

/**
 * 格式化数据用于编辑,自动美化 JSON 格式
 */
export function formatDataForEdit(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return ''
  }

  // 尝试解析为 JSON 并格式化
  try {
    const trimmed = value.trim()

    // 只处理以 { 或 [ 开头的内容(对象或数组)
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = JSON.parse(trimmed)
      return JSON.stringify(parsed, (_key, val) => {
        if (typeof val === 'bigint') return val.toString()
        return val
      }, 2)
    }

    // 对于其他字符串,不改变格式
    return value
  } catch (e) {
    // 解析失败,返回原值
    return value
  }
}

/**
 * 判断值是否看起来像 JSON 格式
 */
export function isLikelyJSON(value: string): boolean {
  if (!value) return false
  const trimmed = value.trim()
  return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
         (trimmed.startsWith('[') && trimmed.endsWith(']'))
}