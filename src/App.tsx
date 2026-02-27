import { useEffect, useState } from 'react'
import ConnectionPanel from './components/ConnectionPanel'
import KeyBrowser from './components/KeyBrowser'
import DataPanel from './components/DataPanel'
import { useRedisStore } from './store/redisStore'

export default function App() {
  const { activeConnectionId, connections, loadConfig } = useRedisStore()
  const [darkMode] = useState(true)

  const activeConnection = activeConnectionId
    ? connections.find((c) => c.id === activeConnectionId)
    : null

  useEffect(() => {
    // Debug: Check electronAPI
    console.log('electronAPI exists?', typeof window.electronAPI)
    console.log('saveConfig exists?', typeof window.electronAPI?.saveConfig)
    console.log('loadConfig exists?', typeof window.electronAPI?.loadConfig)

    // Load saved connection config on app startup
    const initializeConfig = async () => {
      console.log('Initializing config...')
      try {
        await loadConfig()
        console.log('Config initialized')
      } catch (error) {
        console.error('Failed to initialize config:', error)
      }
    }
    initializeConfig()
  }, [loadConfig])

  useEffect(() => {
    // Auto-connect when active connection changes and is not connected
    if (activeConnectionId && !activeConnection?.connected) {
      // This would trigger the connection in a real implementation
      // For now, just log it
      console.log('Should connect to', activeConnectionId)
    }
  }, [activeConnectionId, activeConnection?.connected])

  // Apply dark mode class to html element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <div className={`w-screen h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'} p-2 overflow-hidden`}>
      <div className="flex h-full gap-2 min-w-0">
        {/* Left Panel - Connections (18.75% - 3/16) */}
        <div className="w-[18.75%] min-w-0 flex-shrink-0">
          <ConnectionPanel />
        </div>

        {/* Center Panel - Keys (31.25% - 5/16) */}
        <div className="w-[31.25%] min-w-0 flex-shrink-0">
          <KeyBrowser />
        </div>

        {/* Right Panel - Data/Editor (50% - 8/16) */}
        <div className="flex-1 min-w-0 flex flex-col">
          <DataPanel />
        </div>
      </div>
    </div>
  )
}