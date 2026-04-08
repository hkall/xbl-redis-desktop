import React, { useState } from 'react'
import { Database, Globe, Sun, Moon, RefreshCw, Loader2, Download, ExternalLink, X, CheckCircle, AlertCircle } from 'lucide-react'
import { ToolType, TOOL_CONFIGS } from '@/store/types'

const APP_VERSION = '1.2.0'

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
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; latestVersion: string; downloadUrl?: string } | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; speed: string } | null>(null)
  const [downloadComplete, setDownloadComplete] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const downloadSpeedRef = React.useRef({ lastTime: 0, lastDownloaded: 0, speed: 0 })

  const checkForUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const response = await fetch('https://api.github.com/repos/hkall/xbl-redis-desktop/releases/latest')
      if (response.ok) {
        const data = await response.json()
        const latestVersion = data.tag_name?.replace(/^v/, '') || '0.0.0'

        // Compare versions
        const currentParts = APP_VERSION.split('.').map(Number)
        const latestParts = latestVersion.split('.').map(Number)

        let hasUpdate = false
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
          const current = currentParts[i] || 0
          const latest = latestParts[i] || 0
          if (latest > current) {
            hasUpdate = true
            break
          } else if (latest < current) {
            break
          }
        }

        // Find Windows installer download URL
        let downloadUrl: string | undefined
        if (hasUpdate && data.assets) {
          const windowsAsset = data.assets.find((a: any) =>
            a.name?.endsWith('.exe') || a.name?.includes('windows') || a.name?.includes('win')
          )
          downloadUrl = windowsAsset?.browser_download_url
        }

        setUpdateInfo({ hasUpdate, latestVersion, downloadUrl })
        setShowUpdateDialog(true)
      }
    } catch (error) {
      setUpdateInfo({ hasUpdate: false, latestVersion: APP_VERSION })
      setShowUpdateDialog(true)
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleDownloadUpdate = async () => {
    if (!updateInfo?.downloadUrl) return

    setDownloading(true)
    setDownloadProgress(null)
    setDownloadError(null)

    try {
      const response = await fetch(updateInfo.downloadUrl)
      if (!response.ok) throw new Error('Download failed')

      const contentLength = response.headers.get('content-length')
      const totalSize = contentLength ? parseInt(contentLength) : 0

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader available')

      const chunks: Uint8Array[] = []
      let downloadedSize = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        downloadedSize += value.length

        // Calculate speed
        const now = Date.now()
        const timeDiff = now - downloadSpeedRef.current.lastTime
        if (timeDiff >= 500) {
          const sizeDiff = downloadedSize - downloadSpeedRef.current.lastDownloaded
          const speed = (sizeDiff / timeDiff) * 1000 // bytes per second
          downloadSpeedRef.current = { lastTime: now, lastDownloaded: downloadedSize, speed }

          const speedStr = speed > 1024 * 1024
            ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
            : speed > 1024
              ? `${(speed / 1024).toFixed(0)} KB/s`
              : `${speed.toFixed(0)} B/s`

          const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0
          setDownloadProgress({ percent, speed: speedStr })
        }
      }

      // Combine chunks
      const blob = new Blob(chunks)
      const arrayBuffer = await blob.arrayBuffer()

      // Save file
      const fileName = updateInfo.downloadUrl.split('/').pop() || 'update.exe'
      const savePath = await window.electronAPI?.saveFile({
        defaultFileName: fileName,
        data: Array.from(new Uint8Array(arrayBuffer)),
      })

      if (savePath) {
        setDownloadComplete(savePath)
      } else {
        throw new Error('Failed to save file')
      }
    } catch (error: any) {
      setDownloadError(error.message || 'Download failed')
    } finally {
      setDownloading(false)
      setDownloadProgress(null)
    }
  }

  const handleOpenFile = async () => {
    if (downloadComplete && window.electronAPI?.openPath) {
      await window.electronAPI.openPath(downloadComplete)
    }
  }

  const handleOpenFolder = async () => {
    if (downloadComplete && window.electronAPI?.openPath) {
      await window.electronAPI.openPath(downloadComplete.replace(/[^\\/]+$/, ''))
    }
  }

  return (
    <>
      <div className="h-11 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
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

        {/* Right side actions */}
        <div className="flex items-center gap-3">
          {/* Version and Update Check */}
          <button
            onClick={checkForUpdate}
            disabled={checkingUpdate}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
            title="Check for updates"
          >
            <span className="font-mono">v{APP_VERSION}</span>
            {checkingUpdate ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </button>

          {/* Divider */}
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />

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

      {/* Update Dialog */}
      {showUpdateDialog && updateInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10 dark:border-white/10">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {downloadComplete ? 'Download Complete' : updateInfo.hasUpdate ? 'Update Available' : 'Up to Date'}
              </h3>
              <button
                onClick={() => {
                  setShowUpdateDialog(false)
                  setUpdateInfo(null)
                  setDownloadProgress(null)
                  setDownloadComplete(null)
                  setDownloadError(null)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 text-center">
              {downloadComplete ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Update downloaded successfully!
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleOpenFile}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Installer
                    </button>
                    <button
                      onClick={handleOpenFolder}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Open Folder
                    </button>
                  </div>
                </>
              ) : downloadError ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-red-600 dark:text-red-400 mb-2 font-medium">
                    Download Failed
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{downloadError}</p>
                </>
              ) : downloading ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Download className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-bounce" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Downloading update...
                  </p>
                  {downloadProgress && (
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                  )}
                  {downloadProgress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {downloadProgress.percent}% - {downloadProgress.speed}
                    </p>
                  )}
                </>
              ) : updateInfo.hasUpdate ? (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    A new version is available!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Current: <span className="font-mono">v{APP_VERSION}</span> → Latest: <span className="font-mono text-green-600 dark:text-green-400">v{updateInfo.latestVersion}</span>
                  </p>
                  <button
                    onClick={handleDownloadUpdate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Update
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    You're using the latest version!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    <span className="font-mono">v{APP_VERSION}</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}