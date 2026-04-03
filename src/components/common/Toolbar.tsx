import React from 'react'
import { Database, Globe, Box, Sun, Moon } from 'lucide-react'
import { ToolType, TOOL_CONFIGS } from '@/store/types'

interface ToolbarProps {
  activeTool: ToolType
  onToolChange: (tool: ToolType) => void
  darkMode?: boolean
  onToggleTheme?: () => void
}

// 图标映射
const TOOL_ICONS: Record<ToolType, React.ComponentType<{ className?: string }>> = {
  redis: Database,
  api: Globe,
  mysql: Database,
  mongodb: Database,
}

// 工具颜色配置
const TOOL_COLORS: Record<ToolType, { active: string; hover: string }> = {
  redis: { active: 'bg-red-500', hover: 'hover:bg-red-500/10 hover:text-red-500' },
  api: { active: 'bg-blue-500', hover: 'hover:bg-blue-500/10 hover:text-blue-500' },
  mysql: { active: 'bg-amber-500', hover: 'hover:bg-amber-500/10 hover:text-amber-500' },
  mongodb: { active: 'bg-green-500', hover: 'hover:bg-green-500/10 hover:text-green-500' },
}

export default function Toolbar({ activeTool, onToolChange, darkMode = true, onToggleTheme }: ToolbarProps) {
  const tools: ToolType[] = ['redis', 'api'] // 目前只显示已实现的工具

  return (
    <div className="h-11 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
      {/* Logo and Tool Tabs */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-white">XBL DevTools</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

        {/* Tool Tabs */}
        <div className="flex items-center gap-1">
          {tools.map((toolId) => {
            const config = TOOL_CONFIGS[toolId]
            const Icon = TOOL_ICONS[toolId]
            const isActive = activeTool === toolId
            const colors = TOOL_COLORS[toolId]

            return (
              <button
                key={toolId}
                onClick={() => onToolChange(toolId)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? `${colors.active} text-white shadow-md`
                    : `text-gray-600 dark:text-gray-400 ${colors.hover}`
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-3">
        {/* 快捷键提示 */}
        <div className="text-xs text-gray-400 dark:text-gray-500 hidden sm:block">
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl</kbd>
          <span className="mx-0.5">+</span>
          <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd>
          <span className="ml-1">发送请求</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={darkMode ? '切换到浅色模式' : '切换到深色模式'}
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}