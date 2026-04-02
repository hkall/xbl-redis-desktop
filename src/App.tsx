import { useEffect, useState, useRef, useCallback } from 'react'
import ConnectionPanel from './components/ConnectionPanel'
import KeyBrowser from './components/KeyBrowser'
import DataPanel from './components/DataPanel'
import CommandLine from './components/CommandLine'
import ServerInfo from './components/ServerInfo'
import BatchOperations from './components/BatchOperations'
import DataExport from './components/DataExport'
import Toolbar from './components/common/Toolbar'
import ApiSidebar from './components/api/ApiSidebar'
import ApiWorkspace from './components/api/ApiWorkspace'
import { ToastProvider } from './components/common/Toast'
import { useRedisStore } from './store/redisStore'
import { useApiStore } from './store/apiStore'
import { ToolType } from './store/types'
import { Terminal, Server, List, Download, X } from 'lucide-react'

type PanelType = 'keys' | 'command' | 'server' | 'batch' | 'export'
type ViewMode = 'split' | 'full' // split = 两栏, full = 占满右侧区域

const PANEL_CONFIG = {
  keys: { label: 'Keys', icon: null, color: 'blue' as const },
  command: { label: 'CLI', icon: Terminal, color: 'gray' as const },
  server: { label: 'Server', icon: Server, color: 'purple' as const },
  batch: { label: 'Batch', icon: List, color: 'orange' as const },
  export: { label: 'Export', icon: Download, color: 'green' as const },
}

const COLOR_CLASSES = {
  blue: 'bg-white dark:bg-gray-800',
  gray: 'bg-white dark:bg-gray-800',
  purple: 'bg-white dark:bg-gray-800',
  orange: 'bg-white dark:bg-gray-800',
  green: 'bg-white dark:bg-gray-800',
}

// Resizable divider component
function ResizableDivider({
  onResize,
}: {
  onResize: (delta: number) => void
}) {
  const isDragging = useRef(false)
  const startX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

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
      ref={containerRef}
      className="w-1 flex-shrink-0 bg-transparent hover:bg-blue-500/30 dark:hover:bg-blue-400/30 cursor-col-resize transition-colors group flex items-center justify-center relative"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute inset-y-2 w-0.5 bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-400 rounded-full transition-colors" />
    </div>
  )
}

export default function App() {
  const { activeConnectionId, connections, selectedKey, setSelectedKey, loadConfig } = useRedisStore()
  const { loadFromStorage: loadApiData } = useApiStore()
  const [darkMode] = useState(true)
  const [activeTool, setActiveTool] = useState<ToolType>('redis')
  const [selectedPanel, setSelectedPanel] = useState<PanelType>('keys')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [keysPanelPercent, setKeysPanelPercent] = useState(35) // Default 35% width for keys panel
  const containerRef = useRef<HTMLDivElement>(null)

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

  // Handle keys panel resize with percentage
  const handleKeysPanelResize = useCallback((delta: number) => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const deltaPercent = (delta / containerWidth) * 100
    setKeysPanelPercent(prev => {
      const newPercent = prev + deltaPercent
      return Math.max(15, Math.min(80, newPercent)) // Limit between 15% and 80%
    })
  }, [])

  // Auto switch to full mode for CLI/Server/Batch/Export panels
  useEffect(() => {
    if (selectedPanel !== 'keys') {
      setViewMode('full')
      setSelectedKey(null) // Clear selected key when switching panels
    } else {
      setViewMode('split')
    }
  }, [selectedPanel])

  // Initialize config
  useEffect(() => {
    const initializeConfig = async () => {
      try {
        await loadConfig()
        await loadApiData()
      } catch (error) {
      }
    }
    initializeConfig()
  }, [loadConfig])

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const handlePanelChange = (panel: PanelType) => {
    setSelectedPanel(panel)
  }

  const getPanelComponent = () => {
    const panelConfig = PANEL_CONFIG[selectedPanel]

    switch (selectedPanel) {
      case 'keys':
        return <KeyBrowser />
      case 'command':
        return <CommandLine connectionId={activeConnectionId} />
      case 'server':
        return <ServerInfo connectionId={activeConnectionId} fullMode />
      case 'batch':
        return <BatchOperations connectionId={activeConnectionId} />
      case 'export':
        return <DataExport connectionId={activeConnectionId} />
      default:
        return null
    }
  }

  // Render Redis tool layout
  const renderRedisLayout = () => (
    <>
      {/* Left Panel - Connections */}
      <div className="w-[18%] min-w-0 flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <ConnectionPanel selectedPanel={selectedPanel} onPanelChange={setSelectedPanel} />
      </div>

      {/* Center/Right Main Content Area */}
      {viewMode === 'split' ? (
        // SPLIT VIEW: Keys Panel (center) + Data Panel (right)
        <div ref={containerRef} className="flex-1 flex min-w-0 gap-0">
          {/* Center Panel - Keys */}
          <div
            className="min-w-0 flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700"
            style={{ width: `${keysPanelPercent}%` }}
          >
            <KeyBrowser />
          </div>

          {/* Resizable Divider */}
          <ResizableDivider onResize={handleKeysPanelResize} />

          {/* Right Panel - Data */}
          <div className="flex-1 min-w-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
            <DataPanel />
          </div>
        </div>
      ) : (
        // FULL VIEW: Selected panel occupies entire right area
        <div
          className={`flex-1 min-w-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col ${
            COLOR_CLASSES[PANEL_CONFIG[selectedPanel].color]
          } transition-all duration-300`}
        >
          {/* Panel Header */}
          <div className="flex-shrink-0 h-9 px-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = PANEL_CONFIG[selectedPanel].icon
                return Icon && <Icon className="w-4 h-4" />
              })()}
              <span className="text-sm font-semibold">
                {PANEL_CONFIG[selectedPanel].label}
              </span>
            </div>
            <button
              onClick={() => setSelectedPanel('keys')}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Back to Keys"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {getPanelComponent()}
          </div>
        </div>
      )}
    </>
  )

  // Render API tool layout
  const renderApiLayout = () => (
    <>
      {/* Left Panel - API Sidebar */}
      <div className="w-[280px] min-w-0 flex-shrink-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <ApiSidebar />
      </div>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <ApiWorkspace />
      </div>
    </>
  )

  return (
    <ToastProvider>
      <div className="w-screen h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
        {/* Top Toolbar */}
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />

        {/* Main Content */}
        <div className="flex-1 flex gap-3 p-3 pt-2 min-h-0">
          {activeTool === 'redis' && renderRedisLayout()}
          {activeTool === 'api' && renderApiLayout()}
          {/* MySQL and MongoDB will be added here later */}
        </div>
      </div>
    </ToastProvider>
  )
}