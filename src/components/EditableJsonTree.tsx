import { useState, useCallback, useEffect, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface EditableJsonTreeProps {
  data: any
  onChange: (newData: any) => void
}

// 单独的基础值编辑组件
function BasicValueEditor({
  value,
  onChange,
  className,
  placeholder
}: {
  value: any
  onChange: (newValue: any) => void
  className?: string
  placeholder?: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(() => String(value ?? ''))

  // 当外部 value 变化时，更新编辑值（仅在不编辑时）
  useEffect(() => {
    if (!isEditing) {
      setEditValue(String(value ?? ''))
    }
  }, [value, isEditing])

  const handleFocus = () => {
    setIsEditing(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditValue(e.target.value)
  }

  const handleBlur = () => {
    setIsEditing(false)
    // 进行类型转换
    const trimmed = editValue.trim()
    let newValue: any = trimmed

    if (trimmed === '') {
      newValue = ''
    } else if (trimmed === 'true') {
      newValue = true
    } else if (trimmed === 'false') {
      newValue = false
    } else if (trimmed === 'null') {
      newValue = null
    } else if (/^-?\d+\.?\d*$/.test(trimmed) && !isNaN(Number(trimmed))) {
      newValue = Number(trimmed)
    }

    if (newValue !== value) {
      onChange(newValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setEditValue(String(value ?? ''))
      setIsEditing(false)
    }
  }

  return (
    <input
      type="text"
      value={isEditing ? editValue : String(value ?? '')}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`px-2 py-0.5 text-sm bg-transparent border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:outline-none rounded w-full ${className ?? ''}`}
      placeholder={placeholder}
    />
  )
}

// 内部节点组件
function EditableJsonTreeNode({
  data,
  keyName,
  level = 0,
  isArrayItem = false,
  initiallyExpanded = true,
  onChange,
  path = [],
}: {
  data: any
  keyName?: string
  level?: number
  isArrayItem?: boolean
  initiallyExpanded?: boolean
  onChange: (newData: any) => void
  path?: (string | number)[]
}) {
  // 默认展开所有层级
  const [expanded, setExpanded] = useState(initiallyExpanded)

  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data)
  const isArray = Array.isArray(data)
  const isContainer = isObject || isArray

  const hasChildren = isContainer &&
    (isArray ? data.length > 0 : Object.keys(data).length > 0)

  // 处理子元素变化
  const handleChildChange = useCallback((childKey: string | number, newValue: any) => {
    const updated: any = isArray ? [...(data as any[])] : { ...data }
    if (isArray) {
      updated[childKey as number] = newValue
    } else {
      updated[childKey as string] = newValue
    }
    onChange(updated)
  }, [data, isArray, onChange])

  const toggleExpanded = () => {
    if (hasChildren) {
      setExpanded(!expanded)
    }
  }

  // 容器类型渲染
  if (isContainer) {
    const entries = hasChildren
      ? isArray
        ? data.map((item: any, index: number) => ({ key: index, value: item }))
        : Object.entries(data).map(([key, value]) => ({ key, value }))
      : []

    return (
      <div className="font-mono text-sm">
        {/* 容器起始 */}
        <div className="flex items-start hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded py-0.5 -mx-1 px-1">
          {/* 展开/折叠箭头 */}
          <span
            className="inline-flex items-center justify-center w-4 h-4 mr-1 text-gray-400 transition-transform flex-shrink-0 cursor-pointer"
            style={{ marginTop: 2 }}
            onClick={toggleExpanded}
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
              <span className="text-purple-700 dark:text-purple-400 font-medium">{keyName}</span>
              <span className="text-gray-500 dark:text-gray-400 mx-1">:</span>
            </>
          )}

          {/* 容器类型和长度 */}
          <span className="text-gray-600 dark:text-gray-400">
            {isArray ? `[${data.length}]` : `{${Object.keys(data).length}}`}
          </span>

          {/* 类型标签 */}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
            {hasChildren ? (expanded ? '(点击箭头折叠)' : '(点击箭头展开)') : ''}
          </span>
        </div>

        {/* 子元素 */}
        {expanded && hasChildren && (
          <div className="ml-4 border-l border-gray-300 dark:border-gray-600">
            {entries.map((entry) => {
              return (
                <Fragment
                  key={`${path.join('.')}-${entry.key}`}
                >
                  <EditableJsonTreeNode
                    data={entry.value}
                    keyName={isArray ? undefined : entry.key}
                    level={level + 1}
                    isArrayItem={isArray}
                    initiallyExpanded={true}
                    onChange={(newValue) => handleChildChange(entry.key, newValue)}
                    path={[...path, entry.key]}
                  />
                </Fragment>
              )
            })}
          </div>
        )}

        {/* 容器闭合 */}
        {expanded && hasChildren && (
          <div className="flex items-stretch py-0.5">
            <span className="w-4 mr-1 flex-shrink-0" />
            <span className="text-gray-600 dark:text-gray-400">{isArray ? ']' : '}'}</span>
          </div>
        )}
      </div>
    )
  }

  // 基础值渲染
  let valueClassName: string = 'text-gray-900 dark:text-white'

  if (data === null || data === undefined) {
    valueClassName = 'text-gray-400 italic'
  } else if (typeof data === 'string') {
    valueClassName = 'text-amber-700 dark:text-amber-400'
  } else if (typeof data === 'number') {
    valueClassName = 'text-green-700 dark:text-green-400'
  } else if (typeof data === 'boolean') {
    valueClassName = 'text-blue-700 dark:text-blue-400'
  }

  return (
    <div className="flex items-center hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded py-0.5 -mx-1 px-1">
      <span className="w-4 mr-1 flex-shrink-0" />
      {keyName !== undefined && (
        <>
          <span className="text-purple-700 dark:text-purple-400 font-medium flex-shrink-0">{keyName}</span>
          <span className="text-gray-500 dark:text-gray-400 mx-1 flex-shrink-0">:</span>
        </>
      )}
      <div className="flex-1 min-w-0">
        <BasicValueEditor
          value={data}
          onChange={(newValue) => onChange(newValue)}
          className={valueClassName}
          placeholder={data === null ? 'null' : ''}
        />
      </div>
    </div>
  )
}

// 主组件，包装器
export default function EditableJsonTree({ data, onChange }: EditableJsonTreeProps) {
  return (
    <EditableJsonTreeNode
      data={data}
      onChange={onChange}
      path={[]}
      initiallyExpanded={true}
    />
  )
}