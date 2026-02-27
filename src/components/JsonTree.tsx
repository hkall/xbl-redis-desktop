import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface JsonTreeNodeProps {
  data: any
  keyName?: string
  level?: number
  isArrayItem?: boolean
  initiallyExpanded?: boolean
}

export default function JsonTreeNode({
  data,
  keyName,
  level = 0,
  isArrayItem = false,
  initiallyExpanded = true,
}: JsonTreeNodeProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded && level < 3)

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data)
  const isArray = Array.isArray(data)
  const isContainer = isObject || isArray

  const hasChildren = isContainer &&
    (isArray ? data.length > 0 : Object.keys(data).length > 0)

  const toggleExpanded = () => {
    if (hasChildren) {
      setExpanded(!expanded)
    }
  }

  const indent = level * 20

  // 基础值渲染
  const renderBasicValue = (value: any) => {
    if (value === null) return <span className="text-gray-500 dark:text-gray-400">null</span>
    if (value === undefined) return <span className="text-gray-500 dark:text-gray-400">undefined</span>
    if (typeof value === 'boolean') return <span className="text-blue-600 dark:text-blue-400">{String(value)}</span>
    if (typeof value === 'number') return <span className="text-green-600 dark:text-green-400">{String(value)}</span>
    if (typeof value === 'string') {
      return <span className="text-amber-600 dark:text-amber-400">"{value}"</span>
    }
    return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>
  }

  // 容器类型渲染
  if (isContainer) {
    const entries = hasChildren
      ? isArray
        ? data.map((item: any, index: number) => ({ key: String(index), value: item }))
        : Object.entries(data).map(([key, value]) => ({ key, value }))
      : []

    return (
      <div className="font-mono text-sm">
        {/* 容器起始 */}
        <div
          className="flex items-start hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded cursor-pointer py-0.5 -mx-1 px-1"
          onClick={toggleExpanded}
        >
          {/* 展开/折叠箭头 */}
          <span
            className={`inline-flex items-center justify-center w-4 h-4 mr-1 text-gray-400 transition-transform flex-shrink-0 ${
              expanded ? 'transform rotate-0' : ''
            }`}
            style={{ marginTop: 2 }}
          >
            {hasChildren ? (
              expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : (
              <span className="w-3 h-3 inline-block" />
            )}
          </span>

          {/* Key 名称 */}
          {keyName !== undefined && !isArrayItem && (
            <>
              <span className="text-purple-600 dark:text-purple-400 font-medium">{keyName}</span>
              <span className="text-gray-500 dark:text-gray-400 mx-1">:</span>
            </>
          )}

          {/* 容器类型和长度 */}
          <span className="text-gray-600 dark:text-gray-400">
            {isArray ? `[${data.length}]` : `{${Object.keys(data).length}}`}
          </span>

          {/* 类型标签 */}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            {hasChildren ? clickText : ''}
          </span>
        </div>

        {/* 子元素 */}
        {expanded && hasChildren && (
          <div className="ml-4 border-l border-gray-300 dark:border-gray-600">
            {entries.map((entry, index) => (
              <JsonTreeNode
                key={`${entry.key}-${index}`}
                data={entry.value}
                keyName={isArray ? undefined : entry.key}
                level={level + 1}
                isArrayItem={isArray}
                initiallyExpanded={false}
              />
            ))}
          </div>
        )}

        {/* 容器闭合 */}
        <div className="flex items-stretch py-0.5">
          <span className="w-4 mr-1 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-400">{isArray ? ']' : '}'}</span>
        </div>
      </div>
    )
  }

  // 基础值渲染
  return (
    <div
      className="flex items-start hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded py-0.5 -mx-1 px-1"
      style={{ marginLeft: indent }}
    >
      <span className="w-4 mr-1 flex-shrink-0" />
      {keyName !== undefined && (
        <>
          <span className="text-purple-600 dark:text-purple-400 font-medium">{keyName}</span>
          <span className="text-gray-500 dark:text-gray-400 mx-1">:</span>
        </>
      )}
      {renderBasicValue(data)}
    </div>
  )
}

const clickText = '(点击折叠/展开)'