// 简单的 JSONPath 实现
// 支持: $.data.id, $.data.items[0], $.data.items[*].name

interface JsonPathResult {
  value: any
  path: string
}

// 解析 JSONPath 表达式
function parseJsonPath(path: string): string[] {
  if (!path.startsWith('$')) {
    return []
  }

  // 移除 $ 后解析路径
  const segments: string[] = []
  let current = path.slice(1)

  while (current.length > 0) {
    // 处理 .property
    if (current.startsWith('.')) {
      current = current.slice(1)
      const match = current.match(/^(\w+)/)
      if (match) {
        segments.push(match[1])
        current = current.slice(match[1].length)
      } else {
        break
      }
    }
    // 处理 [index] 或 [*]
    else if (current.startsWith('[')) {
      const match = current.match(/^\[(\*|\d+)\]/)
      if (match) {
        segments.push(`[${match[1]}]`)
        current = current.slice(match[0].length)
      } else {
        break
      }
    }
    else {
      break
    }
  }

  return segments
}

// 根据 JSONPath 获取值
export function getJsonPathValue(obj: any, path: string): any[] {
  if (!path || path === '$') {
    return [obj]
  }

  const segments = parseJsonPath(path)
  if (segments.length === 0) {
    return []
  }

  let currentValues: any[] = [obj]

  for (const segment of segments) {
    const nextValues: any[] = []

    for (const current of currentValues) {
      if (current === null || current === undefined) {
        continue
      }

      // 处理数组索引
      if (segment.startsWith('[')) {
        if (Array.isArray(current)) {
          const index = segment.slice(1, -1)
          if (index === '*') {
            // [*] 获取所有元素
            nextValues.push(...current)
          } else {
            const idx = parseInt(index, 10)
            if (idx >= 0 && idx < current.length) {
              nextValues.push(current[idx])
            }
          }
        }
      }
      // 处理属性
      else {
        if (typeof current === 'object' && segment in current) {
          nextValues.push(current[segment])
        }
      }
    }

    currentValues = nextValues
  }

  return currentValues
}

// 检查 JSONPath 是否存在
export function jsonPathExists(obj: any, path: string): boolean {
  const values = getJsonPathValue(obj, path)
  return values.length > 0 && values[0] !== undefined
}

// 设置 JSONPath 值（用于测试，可选）
export function setJsonPathValue(obj: any, path: string, value: any): boolean {
  const segments = parseJsonPath(path)
  if (segments.length === 0) {
    return false
  }

  let current = obj
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]
    if (segment.startsWith('[')) {
      const index = parseInt(segment.slice(1, -1), 10)
      if (Array.isArray(current) && index >= 0 && index < current.length) {
        current = current[index]
      } else {
        return false
      }
    } else {
      if (typeof current === 'object' && segment in current) {
        current = current[segment]
      } else {
        return false
      }
    }
  }

  const lastSegment = segments[segments.length - 1]
  if (lastSegment.startsWith('[')) {
    const index = parseInt(lastSegment.slice(1, -1), 10)
    if (Array.isArray(current) && index >= 0 && index < current.length) {
      current[index] = value
      return true
    }
  } else {
    if (typeof current === 'object') {
      current[lastSegment] = value
      return true
    }
  }

  return false
}