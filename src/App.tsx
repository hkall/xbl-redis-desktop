import { useEffect, useState } from 'react'
import ConnectionPanel from './components/ConnectionPanel'
import KeyBrowser from './components/KeyBrowser'
import DataPanel from './components/DataPanel'
import CommandLine from './components/CommandLine'
import ServerInfo from './components/ServerInfo'
import BatchOperations from './components/BatchOperations'
import DataExport from './components/DataExport'
import { useRedisStore } from './store/redisStore'
import { Terminal, Server, List, Download, X, ChevronDown } from 'lucide-react'

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

export default function App() {
  const { activeConnectionId, connections, selectedKey, setSelectedKey, loadConfig } = useRedisStore()
  const [darkMode] = useState(true)
  const [selectedPanel, setSelectedPanel] = useState<PanelType>('keys')
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

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
            <div className="w-[30%] min-w-0 flex-shrink-0 rounded-lg overflow-hidden shadow-lg">
              <KeyBrowser />
            </div>

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