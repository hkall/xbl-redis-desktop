import { useEffect, useState, useRef, useCallback } from 'react'
import ConnectionPanel from './components/ConnectionPanel'
import KeyBrowser from './components/KeyBrowser'
import DataPanel from './components/DataPanel'
import CommandLine from './components/CommandLine'
import ServerInfo from './components/ServerInfo'
import BatchOperations from './components/BatchOperations'
import DataExport from './components/DataExport'
import { useRedisStore } from './store/redisStore'
import { Terminal, Server, List, Download, X, ChevronDown, GripVertical } from 'lucide-react'

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
  minWidth = 200,
  maxWidth = 800
}: {
  onResize: (delta: number) => void
  minWidth?: number
  maxWidth?: number
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
      className="w-1.5 flex-shrink-0 bg-transparent hover:bg-red-500/30 dark:hover:bg-red-400/30 cursor-col-resize transition-colors group flex items-center justify-center"
      onMouseDown={handleMouseDown}
    >
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-3 h-3 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  )
}

export default function App() {
  const { activeConnectionId, connections, selectedKey, setSelectedKey, loadConfig } = useRedisStore()
  const [darkMode] = useState(true)
  const [selectedPanel, setSelectedPanel] = useState<PanelType>('keys')
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [keysPanelWidth, setKeysPanelWidth] = useState(350) // Default width for keys panel

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

  // Handle keys panel resize
  const handleKeysPanelResize = useCallback((delta: number) => {
    setKeysPanelWidth(prev => {
      const newWidth = prev + delta
      return Math.max(200, Math.min(800, newWidth))
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

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-1.5 overflow-hidden">
      <div className="flex h-full gap-1.5 min-w-0">
        {/* Left Panel - Connections */}
        <div className="w-[18%] min-w-0 flex-shrink-0 rounded-lg overflow-hidden shadow-lg">
          <ConnectionPanel selectedPanel={selectedPanel} onPanelChange={setSelectedPanel} />
        </div>

        {/* Center/Right Main Content Area */}
        {viewMode === 'split' ? (
          // SPLIT VIEW: Keys Panel (center) + Data Panel (right)
          <>
            {/* Center Panel - Keys */}
            <div
              className="min-w-0 flex-shrink-0 rounded-lg overflow-hidden shadow-lg"
              style={{ width: `${keysPanelWidth}px` }}
            >
              <KeyBrowser />
            </div>

            {/* Resizable Divider */}
            <ResizableDivider onResize={handleKeysPanelResize} />

            {/* Right Panel - Data */}
            <div className="flex-1 min-w-0 rounded-lg overflow-hidden shadow-lg">
              <DataPanel />
            </div>
          </>
        ) : (
          // FULL VIEW: Selected panel occupies entire right area
          <div
            className={`flex-1 min-w-0 rounded-lg overflow-hidden shadow-lg flex flex-col ${
              COLOR_CLASSES[PANEL_CONFIG[selectedPanel].color]
            } transition-all duration-300`}
          >
            {/* Panel Header */}
            <div className="flex-shrink-0 h-9 px-4 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-white/50 dark:bg-black/30 backdrop-blur-sm">
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
      </div>
    </div>
  )
}